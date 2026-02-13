import Mistral from '@mistralai/mistralai';
import type { ProductData, VisionAnalysis, MarketingAngle } from '../types';

const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || '',
});

const MODEL = 'mistral-large-latest';
const MAX_RETRIES = 3;
const MIN_QUALITY_SCORE = 7;
const RETRY_DELAY_BASE = 1000;
const COST_PER_1K_TOKENS = 0.002;

let totalCost = 0;

export function getTotalCost(): number {
  return totalCost;
}

export function resetCostTracking(): void {
  totalCost = 0;
}

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
  const dominantColors = visionAnalysis.colorPalette?.dominant?.join(', ') || 'Not specified';
  const visualHooks = visionAnalysis.visualHooks?.hooks?.join(', ') || 'Not specified';
  const tiktokAppeal = visionAnalysis.visualHooks?.tiktokAppeal || 50;
  
  return `You are an expert TikTok marketing strategist. Generate 3 high-quality marketing angles for the following product.

Product Information:
- Name: ${productData.name}
- Description: ${productData.description}
- Price: $${productData.price}
- Rating: ${productData.rating || 'N/A'}/5 (${productData.reviewCount || 0} reviews)

Visual Analysis:
- Dominant Colors: ${dominantColors}
- Visual Hooks: ${visualHooks}
- TikTok Appeal Score: ${tiktokAppeal}/100
- Packaging Quality: ${visionAnalysis.packagingQuality?.score || 'N/A'}/100
- Visual Style: ${visionAnalysis.backgroundRecommendations?.style || 'clean'}

Generate EXACTLY 3 distinct marketing angles. Each angle must include:
1. hook: A catchy 2-second TikTok hook (8-12 words max, attention-grabbing)
2. script: Complete TikTok script (30-60 seconds when read aloud, 150-300 words)
3. targetAudience: Specific demographic (age, interests, pain points)
4. tone: One of: funny, educational, emotional, inspirational, controversial, trending
5. qualityScore: Self-assessment score 1-10 (must be >= ${MIN_QUALITY_SCORE})
6. estimatedEngagement: Predicted engagement rate percentage (1-100)

Requirements:
- Each angle must be unique and target different audiences or approaches
- Scripts must be natural, conversational, and TikTok-native
- Hooks must create immediate curiosity or emotional response
- Quality scores must reflect realistic assessment of viral potential
- All 3 angles must score >= ${MIN_QUALITY_SCORE}/10 in quality

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
  
  if (typeof angle.hook !== 'string' || angle.hook.length < 10 || angle.hook.length > 150) {
    return false;
  }
  
  if (typeof angle.script !== 'string' || angle.script.length < 100 || angle.script.length > 1500) {
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

function estimateCost(promptTokens: number, completionTokens: number): number {
  const totalTokens = promptTokens + completionTokens;
  return (totalTokens / 1000) * COST_PER_1K_TOKENS;
}

async function callMistralAPIWithRetry(
  productData: ProductData,
  visionAnalysis: VisionAnalysis,
  attempt: number = 0
): Promise<{ response: MistralAngleResponse; cost: number }> {
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
      maxTokens: 2500,
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
    
    const promptTokens = prompt.length / 4;
    const completionTokens = content.length / 4;
    const cost = estimateCost(promptTokens, completionTokens);
    
    return { response: parsed, cost };
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
      console.warn(`Mistral API attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callMistralAPIWithRetry(productData, visionAnalysis, attempt + 1);
    }
    
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
  
  if (!visionAnalysis) {
    throw new Error('Invalid vision analysis data');
  }
  
  let lastError: Error | null = null;
  
  for (let qualityAttempt = 1; qualityAttempt <= 2; qualityAttempt++) {
    try {
      const { response, cost } = await callMistralAPIWithRetry(productData, visionAnalysis);
      totalCost += cost;
      
      const averageQuality = calculateAverageQuality(response.angles);
      
      if (averageQuality < MIN_QUALITY_SCORE) {
        lastError = new Error(
          `Quality score too low: ${averageQuality.toFixed(1)}/10 (minimum: ${MIN_QUALITY_SCORE}/10)`
        );
        
        if (qualityAttempt < 2) {
          console.warn(
            `Quality attempt ${qualityAttempt}/2: Score ${averageQuality.toFixed(1)}/10 is below threshold. Retrying...`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
      }
      
      const marketingAngles: MarketingAngle[] = response.angles.map((angle, index) => {
        const confidence = Math.min(100, Math.round((angle.qualityScore / 10) * 100));
        
        return {
          id: `angle-${Date.now()}-${index}`,
          hook: angle.hook.trim(),
          script: angle.script.trim(),
          targetAudience: angle.targetAudience.trim(),
          tone: angle.tone.toLowerCase() as MarketingAngle['tone'],
          qualityScore: Math.round(angle.qualityScore * 10) / 10,
          confidence,
          estimatedEngagement: Math.round(angle.estimatedEngagement * 10) / 10,
          createdAt: new Date(),
          metadata: {
            model: MODEL,
            cost,
            averageQualityScore: averageQuality,
          },
        };
      });
      
      return marketingAngles;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      
      if (qualityAttempt < 2) {
        console.warn(
          `Quality attempt ${qualityAttempt}/2 failed: ${lastError.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  
  throw new Error(
    `Failed to generate marketing angles with sufficient quality. Last error: ${lastError?.message || 'Unknown error'}`
  );
}