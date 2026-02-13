import OpenAI from 'openai';
import { VisionAnalysis } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 0,
});

const VISION_MODEL = 'gpt-4-vision-preview';
const MAX_TOKENS = 1500;
const ANALYSIS_TIMEOUT = 60000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000;
const INPUT_COST_PER_1K = 0.01;
const OUTPUT_COST_PER_1K = 0.03;

let totalCost = 0;

export function getTotalCost(): number {
  return totalCost;
}

export function resetCostTracking(): void {
  totalCost = 0;
}

interface VisionPromptResponse {
  packagingQuality: {
    score: number;
    analysis: string;
    strengths: string[];
    weaknesses: string[];
  };
  colorPalette: {
    dominant: string[];
    accent: string[];
    mood: string;
    vibrancy: number;
  };
  visualHooks: {
    hooks: string[];
    engagement_potential: number;
    tiktok_appeal: number;
  };
  productPlacement: {
    recommended_angles: string[];
    lighting_suggestions: string[];
    focal_points: string[];
  };
  backgroundRecommendations: {
    settings: string[];
    props: string[];
    style: string;
  };
}

function createAnalysisPrompt(): string {
  return `Analyze this product image for e-commerce and TikTok marketing. Provide a detailed JSON response with the following structure:

{
  "packagingQuality": {
    "score": <0-100>,
    "analysis": "detailed assessment",
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  },
  "colorPalette": {
    "dominant": ["color1", "color2"],
    "accent": ["color1", "color2"],
    "mood": "vibrant/muted/elegant/playful",
    "vibrancy": <0-100>
  },
  "visualHooks": {
    "hooks": ["hook1", "hook2", "hook3"],
    "engagement_potential": <0-100>,
    "tiktok_appeal": <0-100>
  },
  "productPlacement": {
    "recommended_angles": ["angle1", "angle2"],
    "lighting_suggestions": ["suggestion1", "suggestion2"],
    "focal_points": ["point1", "point2"]
  },
  "backgroundRecommendations": {
    "settings": ["setting1", "setting2"],
    "props": ["prop1", "prop2"],
    "style": "minimalist/lifestyle/dramatic/clean"
  }
}

Focus on:
- Professional packaging assessment
- Color psychology for social media
- Visual elements that stop scrolling
- Optimal presentation for TikTok videos
- Actionable recommendations

Respond ONLY with valid JSON, no additional text.`;
}

function validateImageUrl(imageUrl: string): void {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Invalid image URL: must be a non-empty string');
  }

  try {
    const url = new URL(imageUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid image URL: must use http or https protocol');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid image URL format: ${imageUrl}`);
    }
    throw error;
  }
}

function parseVisionResponse(content: string): VisionPromptResponse {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as VisionPromptResponse;

    if (!parsed.packagingQuality || typeof parsed.packagingQuality.score !== 'number') {
      throw new Error('Missing or invalid packagingQuality in response');
    }

    if (!parsed.colorPalette || !Array.isArray(parsed.colorPalette.dominant)) {
      throw new Error('Missing or invalid colorPalette in response');
    }

    if (!parsed.visualHooks || !Array.isArray(parsed.visualHooks.hooks)) {
      throw new Error('Missing or invalid visualHooks in response');
    }

    if (!parsed.productPlacement || !Array.isArray(parsed.productPlacement.recommended_angles)) {
      throw new Error('Missing or invalid productPlacement in response');
    }

    if (!parsed.backgroundRecommendations || !Array.isArray(parsed.backgroundRecommendations.settings)) {
      throw new Error('Missing or invalid backgroundRecommendations in response');
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse vision API response as JSON: ${error.message}`);
    }
    throw error;
  }
}

function calculateCompletenessScore(response: VisionPromptResponse): number {
  let score = 0;
  let maxScore = 0;

  maxScore += 20;
  if (response.packagingQuality.score >= 0 && response.packagingQuality.score <= 100) {
    score += 10;
  }
  if (response.packagingQuality.strengths.length > 0 && response.packagingQuality.weaknesses.length > 0) {
    score += 10;
  }

  maxScore += 20;
  if (response.colorPalette.dominant.length >= 2) score += 10;
  if (response.colorPalette.vibrancy >= 0 && response.colorPalette.vibrancy <= 100) score += 10;

  maxScore += 20;
  if (response.visualHooks.hooks.length >= 2) score += 10;
  if (response.visualHooks.tiktok_appeal >= 0 && response.visualHooks.tiktok_appeal <= 100) score += 10;

  maxScore += 20;
  if (response.productPlacement.recommended_angles.length >= 2) score += 10;
  if (response.productPlacement.lighting_suggestions.length > 0) score += 10;

  maxScore += 20;
  if (response.backgroundRecommendations.settings.length >= 2) score += 10;
  if (response.backgroundRecommendations.props.length > 0) score += 10;

  return Math.round((score / maxScore) * 100);
}

function transformToVisionAnalysis(response: VisionPromptResponse, estimatedCost: number): VisionAnalysis {
  const completenessScore = calculateCompletenessScore(response);

  return {
    packagingQuality: {
      score: Math.min(100, Math.max(0, response.packagingQuality.score)),
      analysis: response.packagingQuality.analysis || 'No analysis provided',
      strengths: response.packagingQuality.strengths || [],
      weaknesses: response.packagingQuality.weaknesses || [],
    },
    colorPalette: {
      dominant: response.colorPalette.dominant || [],
      accent: response.colorPalette.accent || [],
      mood: response.colorPalette.mood || 'neutral',
      vibrancy: Math.min(100, Math.max(0, response.colorPalette.vibrancy || 50)),
    },
    visualHooks: {
      hooks: response.visualHooks.hooks || [],
      engagementPotential: Math.min(100, Math.max(0, response.visualHooks.engagement_potential || 50)),
      tiktokAppeal: Math.min(100, Math.max(0, response.visualHooks.tiktok_appeal || 50)),
    },
    productPlacement: {
      recommendedAngles: response.productPlacement.recommended_angles || [],
      lightingSuggestions: response.productPlacement.lighting_suggestions || [],
      focalPoints: response.productPlacement.focal_points || [],
    },
    backgroundRecommendations: {
      settings: response.backgroundRecommendations.settings || [],
      props: response.backgroundRecommendations.props || [],
      style: response.backgroundRecommendations.style || 'clean',
    },
    metadata: {
      completenessScore,
      confidence: completenessScore,
      estimatedCost,
      timestamp: new Date().toISOString(),
      model: VISION_MODEL,
    },
  };
}

async function callVisionAPIWithRetry(imageUrl: string, attempt: number = 0): Promise<VisionPromptResponse> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Vision API request timed out')), ANALYSIS_TIMEOUT);
  });

  const apiPromise = openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: createAnalysisPrompt(),
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
  });

  try {
    const completion = await Promise.race([apiPromise, timeoutPromise]);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Vision API');
    }

    return parseVisionResponse(content);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429 || error.status === 500 || error.status === 503) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          console.warn(`Vision API error (${error.status}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return callVisionAPIWithRetry(imageUrl, attempt + 1);
        }
      }
      
      if (error.status === 400) {
        throw new Error(`Invalid image or request: ${error.message}`);
      } else if (error.status === 401) {
        throw new Error('OpenAI API authentication failed. Check your API key.');
      } else if (error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else if (error.status === 500 || error.status === 503) {
        throw new Error('OpenAI API service error. Please try again later.');
      }
      throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
    }
    throw error;
  }
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * INPUT_COST_PER_1K;
  const outputCost = (outputTokens / 1000) * OUTPUT_COST_PER_1K;
  return inputCost + outputCost;
}

export async function analyzeProductImage(imageUrl: string): Promise<VisionAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    validateImageUrl(imageUrl);

    const visionResponse = await callVisionAPIWithRetry(imageUrl);

    const estimatedInputTokens = 1200;
    const estimatedOutputTokens = 800;
    const cost = estimateCost(estimatedInputTokens, estimatedOutputTokens);
    totalCost += cost;

    const analysis = transformToVisionAnalysis(visionResponse, cost);

    if (analysis.metadata.completenessScore < 50) {
      console.warn(
        `Low completeness score (${analysis.metadata.completenessScore}%) for image analysis. Some fields may be incomplete.`
      );
    }

    return analysis;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 400) {
        throw new Error(`Invalid image or request: ${error.message}`);
      } else if (error.status === 401) {
        throw new Error('OpenAI API authentication failed. Check your API key.');
      } else if (error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else if (error.status === 500 || error.status === 503) {
        throw new Error('OpenAI API service error. Please try again later.');
      }
      throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
    }

    if (error instanceof Error) {
      throw new Error(`Vision analysis failed: ${error.message}`);
    }

    throw new Error('Unknown error occurred during vision analysis');
  }
}

export { analyzeProductImage as default };