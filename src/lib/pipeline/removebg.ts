import axios from 'axios';
import { PNG } from 'pngjs';

interface RemoveBackgroundResult {
  transparentUrl: string;
  originalUrl: string;
  cost: number;
  hasAlphaChannel: boolean;
  warning?: string;
}

interface RemoveBgResponse {
  data: {
    result_b64: string;
  };
}

const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';
const COST_PER_IMAGE = 0.20;

class BackgroundRemovalError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'BackgroundRemovalError';
  }
}

async function validatePngWithAlpha(base64Data: string): Promise<boolean> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const png = PNG.sync.read(buffer);
    return png.colorType === 6 || png.colorType === 4;
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

export async function removeBackground(imageInput: string): Promise<RemoveBackgroundResult> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  
  if (!apiKey) {
    throw new BackgroundRemovalError('REMOVE_BG_API_KEY environment variable is not set');
  }

  const originalUrl = imageInput;
  let requestPayload: Record<string, string>;

  try {
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
    
    const hasAlphaChannel = await validatePngWithAlpha(base64Result);
    
    if (!hasAlphaChannel) {
      console.warn('Warning: Processed image may not have a proper alpha channel');
    }

    const transparentUrl = `data:image/png;base64,${base64Result}`;

    return {
      transparentUrl,
      originalUrl,
      cost: COST_PER_IMAGE,
      hasAlphaChannel
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorMessage = error.response?.data?.toString() || error.message;
      
      if (status === 403) {
        throw new BackgroundRemovalError('Invalid API key or insufficient credits');
      } else if (status === 400) {
        throw new BackgroundRemovalError(`Bad request: ${errorMessage}`);
      } else if (status === 402) {
        throw new BackgroundRemovalError('Insufficient credits in remove.bg account');
      }
      
      console.error('Background removal failed, returning original image:', errorMessage);
    } else {
      console.error('Unexpected error during background removal:', error);
    }

    let fallbackUrl = originalUrl;
    if (isBase64Image(originalUrl) && !originalUrl.startsWith('data:')) {
      fallbackUrl = await convertBase64ToUrl(originalUrl);
    }

    return {
      transparentUrl: fallbackUrl,
      originalUrl,
      cost: 0,
      hasAlphaChannel: false,
      warning: 'Background removal failed. Returning original image.'
    };
  }
}

export { RemoveBackgroundResult, BackgroundRemovalError };