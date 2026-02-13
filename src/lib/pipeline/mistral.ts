import Mistral from '@mistralai/mistralai';
import type { ProductData, VisionAnalysis, MarketingAngle } from '../types';

const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || '',
});

const MODEL = 'mistral-large-latest';
const MAX_RETRIES = 3;
const MIN_QUALITY_SCORE = 8;

interface MistralAngleResponse {
  angles: Array<{
    hook: string;
    script: string;
    targetAudience: string;
    tone: string;
    qualityScore: number;
    estimatedEngagement: number;
  }>;
}

function buildPrompt(productData: ProductData, visionAnalysis: VisionAnalysis): string {
  return `You are an expert TikTok marketing strategist. Generate 3 high-quality marketing angles for the following product.

Product Information:
- Name: ${productData.name}
- Description: ${productData.description}
- Price: $${productData.price}
- Category: ${productData.category || 'Not specified'}
- Key Features: ${productData.features?.join(', ') || 'Not specified'}

Visual Analysis:
- Colors: ${visionAnalysis.dominantColors.join(', ')}
- Detected Objects: ${visionAnalysis.objects.join(', ')}
- Text Detected: ${visionAnalysis.text.join(', ')}
- Visual Style: ${visionAnalysis.style}
- Labels: ${visionAnalysis.labels.join(', ')}

Generate EXACTLY 3 distinct marketing angles. Each angle must include:
1. hook: A catchy 2-second TikTok hook (8-12 words max, attention-grabbing)
2. script: Complete TikTok script (30-60 seconds when read aloud, 150-300 words)
3. targetAudience: Specific demographic (age, interests, pain points)
4. tone: One of: funny, educational, emotional, inspirational, controversial, trending
5. qualityScore: Self-assessment score 1-10 (must be >= 8)
6. estimatedEngagement: Predicted engagement rate percentage (1-100)

Requirements:
- Each angle must be unique and target different audiences or approaches
- Scripts must be natural, conversational, and TikTok-native
- Hooks must create immediate curiosity or emotional response
- Quality scores must reflect realistic assessment of viral potential
- All 3 angles must score >= 8/10 in quality

Respond with valid JSON only:
{
  "angles": [
    {
      "hook": "string",
      "script": "string",
      "targetAudience": "string",
      "tone": "string",
      "qualityScore": number,
      "estimatedEngagement": number
    }
  ]
}`;
}

function validateAngle(angle: any): boolean {
  if (!angle || typeof angle !== 'object') return false;
  
  if (typeof angle.hook !== 'string' || angle.hook.length < 10 || angle.hook.length > 100) {
    return false;
  }
  
  if (typeof angle.script !== 'string' || angle.script.length < 100 || angle.script.length > 1000) {
    return false;
  }
  
  if (typeof angle.targetAudience !== 'string' || angle.targetAudience.length < 10) {
    return false;
  }
  
  const validTones = ['funny', 'educational', 'emotional', 'inspirational', 'controversial', 'trending'];
  if (!validTones.includes(angle.tone?.toLowerCase())) {
    return false;
  }
  
  if (typeof angle.qualityScore !== 'number' || angle.qualityScore < 1 || angle.qualityScore > 10) {
    return false;
  }
  
  if (typeof angle.estimatedEngagement !== 'number' || angle.estimatedEngagement < 0 || angle.estimatedEngagement > 100) {
    return false;
  }
  
  return true;
}

function validateResponse(response: any): response is MistralAngleResponse {
  if (!response || typeof response !== 'object') return false;
  if (!Array.isArray(response.angles)) return false;
  if (response.angles.length !== 3) return false;
  
  return response.angles.every(validateAngle);
}

function calculateAverageQuality(angles: MistralAngleResponse['angles']): number {
  const sum = angles.reduce((acc, angle) => acc + angle.qualityScore, 0);
  return sum / angles.length;
}

async function callMistralAPI(
  productData: ProductData,
  visionAnalysis: VisionAnalysis
): Promise<MistralAngleResponse> {
  const prompt = buildPrompt(productData, visionAnalysis);
  
  try {
    const response = await mistralClient.chat.complete({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
      responseFormat: {
        type: 'json_object',
      },
    });
    
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Mistral API');
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse Mistral response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    if (!validateResponse(parsed)) {
      throw new Error('Invalid response structure from Mistral API');
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Mistral API call failed: ${error.message}`);
    }
    throw new Error('Mistral API call failed: Unknown error');
  }
}

export async function generateMarketingAngles(
  productData: ProductData,
  visionAnalysis: VisionAnalysis
): Promise<MarketingAngle[]> {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY environment variable is not set');
  }
  
  if (!productData || !productData.name || !productData.description) {
    throw new Error('Invalid product data: name and description are required');
  }
  
  if (!visionAnalysis || !visionAnalysis.dominantColors || !visionAnalysis.objects) {
    throw new Error('Invalid vision analysis data');
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await callMistralAPI(productData, visionAnalysis);
      const averageQuality = calculateAverageQuality(response.angles);
      
      if (averageQuality < MIN_QUALITY_SCORE) {
        lastError = new Error(
          `Quality score too low: ${averageQuality.toFixed(1)}/10 (minimum: ${MIN_QUALITY_SCORE}/10)`
        );
        
        if (attempt < MAX_RETRIES) {
          console.warn(
            `Attempt ${attempt}/${MAX_RETRIES}: Quality score ${averageQuality.toFixed(1)}/10 is below threshold. Retrying...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      
      const marketingAngles: MarketingAngle[] = response.angles.map((angle, index) => ({
        id: `angle-${Date.now()}-${index}`,
        hook: angle.hook.trim(),
        script: angle.script.trim(),
        targetAudience: angle.targetAudience.trim(),
        tone: angle.tone.toLowerCase() as MarketingAngle['tone'],
        qualityScore: Math.round(angle.qualityScore * 10) / 10,
        estimatedEngagement: Math.round(angle.estimatedEngagement * 10) / 10,
        createdAt: new Date(),
      }));
      
      return marketingAngles;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      
      if (attempt < MAX_RETRIES) {
        console.warn(
          `Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}. Retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw new Error(
    `Failed to generate marketing angles after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}