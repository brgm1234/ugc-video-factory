import axios from 'axios';
import { PNG } from 'pngjs';

interface RemoveBackgroundResult {
  transparentUrl: string;
  originalUrl: string;
  cost: number;
  hasAlphaChannel: boolean;
  confidence: number;
  warning?: string;
}

interface RemoveBgResponse {
  data: {
    result_b64: string;
  };
}

const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';
const COST_PER_IMAGE = 0.20;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000;

let totalCost = 0;

export function getTotalCost(): number {
  return totalCost;
}

export function resetCostTracking(): void {
  totalCost = 0;
}

class BackgroundRemovalError extends Error {
  constructor(message: string, public readonly originalError?: unknown, public readonly isRetryable: boolean = false) {
    super(message);
    this.name = 'BackgroundRemovalError';
  }
}

async function validatePngWithAlpha(base64Data: string): Promise<{ hasAlpha: boolean; confidence: number }> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const png = PNG.sync.read(buffer);
    
    const hasAlpha = png.colorType === 6 || png.colorType === 4;
    
    let confidence = 100;
    if (!hasAlpha) {
      confidence = 0;
    } else {
      let transparentPixels = 0;
      let totalPixels = png.width * png.height;
      
      for (let i = 0; i < png.data.length; i += 4) {
        const alpha = png.data[i + 3];
        if (alpha < 255) {
          transparentPixels++;
        }
      }
      
      const transparencyRatio = transparentPixels / totalPixels;
      if (transparencyRatio < 0.05) {
        confidence = 50;
      } else if (transparencyRatio < 0.1) {
        confidence = 70;
      } else {
        confidence = 95;
      }
    }
    
    return { hasAlpha, confidence };
  } catch (error) {
    throw new BackgroundRemovalError('Failed to validate PNG format', error);
  }
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function isBase64Image(str: string): boolean {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/.test(str) || /^[A-Za-z0-9+/]+=*$/.test(str);
}

async function convertBase64ToUrl(base64: string): Promise<string> {
  const matches = base64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (matches) {
    return base64;
  }
  return `data:image/png;base64,${base64}`;
}

async function callRemoveBgAPI(
  imageInput: string,
  apiKey: string,
  attempt: number = 0
): Promise<{ base64Result: string; cost: number }> {
  let requestPayload: Record<string, string>;

  if (isValidUrl(imageInput)) {
    requestPayload = {
      image_url: imageInput,
      size: 'auto',
      format: 'png'
    };
  } else if (isBase64Image(imageInput)) {
    let base64Data = imageInput;
    const matches = imageInput.match(/^data:image\/[a-z]+;base64,(.+)$/);
    if (matches) {
      base64Data = matches[1];
    }
    requestPayload = {
      image_file_b64: base64Data,
      size: 'auto',
      format: 'png'
    };
  } else {
    throw new BackgroundRemovalError('Invalid image input: must be a valid URL or base64 string');
  }

  try {
    const response = await axios.post<ArrayBuffer>(
      REMOVE_BG_API_URL,
      requestPayload,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const base64Result = Buffer.from(response.data).toString('base64');
    return { base64Result, cost: COST_PER_IMAGE };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorMessage = error.response?.data?.toString() || error.message;
      
      if (status === 403) {
        throw new BackgroundRemovalError('Invalid API key or insufficient credits', error, false);
      } else if (status === 400) {
        throw new BackgroundRemovalError(`Bad request: ${errorMessage}`, error, false);
      } else if (status === 402) {
        throw new BackgroundRemovalError('Insufficient credits in remove.bg account', error, false);
      } else if (status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt) * 2;
          console.warn(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return callRemoveBgAPI(imageInput, apiKey, attempt + 1);
        }
        throw new BackgroundRemovalError('Rate limit exceeded', error, true);
      } else if (status && status >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          console.warn(`Server error (${status}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return callRemoveBgAPI(imageInput, apiKey, attempt + 1);
        }
        throw new BackgroundRemovalError(`Server error: ${errorMessage}`, error, true);
      }
      
      throw new BackgroundRemovalError(`API error: ${errorMessage}`, error, false);
    }
    
    throw new BackgroundRemovalError('Unexpected error', error, false);
  }
}

export async function removeBackground(imageInput: string): Promise<RemoveBackgroundResult> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  
  if (!apiKey) {
    console.warn('REMOVE_BG_API_KEY not set, returning original image');
    
    let fallbackUrl = imageInput;
    if (isBase64Image(imageInput) && !imageInput.startsWith('data:')) {
      fallbackUrl = await convertBase64ToUrl(imageInput);
    }
    
    return {
      transparentUrl: fallbackUrl,
      originalUrl: imageInput,
      cost: 0,
      hasAlphaChannel: false,
      confidence: 0,
      warning: 'Background removal skipped: API key not configured',
    };
  }

  const originalUrl = imageInput;

  try {
    const { base64Result, cost } = await callRemoveBgAPI(imageInput, apiKey);
    
    const validation = await validatePngWithAlpha(base64Result);
    
    if (!validation.hasAlpha) {
      console.warn('Warning: Processed image may not have a proper alpha channel');
    }

    const transparentUrl = `data:image/png;base64,${base64Result}`;

    totalCost += cost;

    return {
      transparentUrl,
      originalUrl,
      cost,
      hasAlphaChannel: validation.hasAlpha,
      confidence: validation.confidence,
    };
  } catch (error) {
    console.error('Background removal failed:', error);
    
    let fallbackUrl = originalUrl;
    if (isBase64Image(originalUrl) && !originalUrl.startsWith('data:')) {
      fallbackUrl = await convertBase64ToUrl(originalUrl);
    }

    const isRetryable = error instanceof BackgroundRemovalError && error.isRetryable;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      transparentUrl: fallbackUrl,
      originalUrl,
      cost: 0,
      hasAlphaChannel: false,
      confidence: 0,
      warning: `Background removal failed: ${errorMessage}. Returning original image.${isRetryable ? ' (Retryable)' : ''}`,
    };
  }
}

export { RemoveBackgroundResult, BackgroundRemovalError };