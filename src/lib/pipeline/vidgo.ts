import axios, { AxiosError } from 'axios';
import { MarketingAngle, VideoGenResult } from '../types';

const VIDGO_API_URL = 'https://api.vidgo.ai/v1/generate';
const VIDGO_API_KEY = process.env.VIDGO_API_KEY || '';
const MAX_POLL_DURATION = 5 * 60 * 1000;
const POLL_INTERVAL = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000;
const COST_PER_REQUEST = 0.03;

let totalCost = 0;

export function getTotalCost(): number {
  return totalCost;
}

export function resetCostTracking(): void {
  totalCost = 0;
}

interface VidgoGenerateRequest {
  script: string;
  images: string[];
  metadata?: {
    title?: string;
    tags?: string[];
  };
}

interface VidgoGenerateResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  resolution?: {
    width: number;
    height: number;
  };
  error?: string;
}

interface VidgoStatusResponse extends VidgoGenerateResponse {}

class VidgoError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'VidgoError';
  }
}

async function makeVidgoRequest<T>(
  url: string,
  method: 'GET' | 'POST',
  data?: any,
  retryCount = 0
): Promise<T> {
  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': `Bearer ${VIDGO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      validateStatus: (status) => status < 600,
    });
    
    if (response.status >= 400) {
      throw new AxiosError(
        `HTTP ${response.status}`,
        String(response.status),
        response.config,
        response.request,
        response
      );
    }
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status;
    
    if (statusCode && statusCode >= 500 && statusCode < 600) {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
        console.warn(`Vidgo API server error (${statusCode}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeVidgoRequest<T>(url, method, data, retryCount + 1);
      }
      throw new VidgoError(
        `Vidgo API server error: ${axiosError.message}`,
        statusCode,
        true
      );
    }
    
    if (statusCode === 429) {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount) * 2;
        console.warn(`Vidgo API rate limit, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeVidgoRequest<T>(url, method, data, retryCount + 1);
      }
      throw new VidgoError(
        'Vidgo API rate limit exceeded',
        statusCode,
        true
      );
    }
    
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      const errorMessage = (axiosError.response?.data as any)?.error || axiosError.message;
      throw new VidgoError(
        `Vidgo API client error: ${errorMessage}`,
        statusCode,
        false
      );
    }
    
    throw new VidgoError(
      `Vidgo API request failed: ${axiosError.message}`,
      statusCode,
      false
    );
  }
}

async function initiateVideoGeneration(
  angle: MarketingAngle,
  productImages: string[]
): Promise<string> {
  if (!VIDGO_API_KEY) {
    throw new VidgoError('VIDGO_API_KEY environment variable is not set', undefined, false);
  }

  if (!productImages || productImages.length === 0) {
    throw new VidgoError('At least one product image is required', undefined, false);
  }

  const validImages = productImages.filter(img => {
    try {
      new URL(img);
      return true;
    } catch {
      return false;
    }
  });

  if (validImages.length === 0) {
    throw new VidgoError('No valid image URLs provided', undefined, false);
  }

  const requestBody: VidgoGenerateRequest = {
    script: angle.script,
    images: validImages,
    metadata: {
      title: angle.hook,
      tags: [angle.tone, angle.targetAudience],
    },
  };

  const response = await makeVidgoRequest<VidgoGenerateResponse>(
    VIDGO_API_URL,
    'POST',
    requestBody
  );

  if (!response.id) {
    throw new VidgoError('Invalid response from Vidgo API: missing job ID', undefined, false);
  }

  return response.id;
}

async function pollForCompletion(jobId: string): Promise<VidgoStatusResponse> {
  const startTime = Date.now();
  const statusUrl = `${VIDGO_API_URL}/${jobId}`;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  while (Date.now() - startTime < MAX_POLL_DURATION) {
    try {
      const status = await makeVidgoRequest<VidgoStatusResponse>(
        statusUrl,
        'GET'
      );

      consecutiveErrors = 0;

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed') {
        throw new VidgoError(
          `Video generation failed: ${status.error || 'Unknown error'}`,
          undefined,
          false
        );
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      consecutiveErrors++;
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw new VidgoError(
          `Too many consecutive errors while polling: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          false
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  throw new VidgoError(
    `Video generation timed out after ${MAX_POLL_DURATION / 1000} seconds`,
    undefined,
    false
  );
}

function validateVideoMetadata(response: VidgoStatusResponse): void {
  if (!response.video_url) {
    throw new VidgoError('Generated video missing video URL', undefined, false);
  }

  try {
    new URL(response.video_url);
  } catch {
    throw new VidgoError('Generated video has invalid URL', undefined, false);
  }

  if (!response.thumbnail_url) {
    throw new VidgoError('Generated video missing thumbnail URL', undefined, false);
  }

  if (!response.duration || response.duration <= 0) {
    throw new VidgoError('Generated video has invalid duration', undefined, false);
  }

  if (!response.resolution || !response.resolution.width || !response.resolution.height) {
    throw new VidgoError('Generated video missing resolution information', undefined, false);
  }

  if (response.resolution.width < 640 || response.resolution.height < 480) {
    throw new VidgoError(
      `Generated video resolution too low: ${response.resolution.width}x${response.resolution.height}`,
      undefined,
      false
    );
  }
}

function calculateConfidence(video: VidgoStatusResponse, metadata: { duration: number; resolution: { width: number; height: number } }): number {
  let confidence = 100;
  
  if (metadata.duration < 10) confidence -= 10;
  if (metadata.duration > 90) confidence -= 5;
  
  if (metadata.resolution.width < 1080) confidence -= 10;
  if (metadata.resolution.height < 1920) confidence -= 10;
  
  if (!video.thumbnail_url) confidence -= 5;
  
  return Math.max(0, Math.min(100, confidence));
}

export async function generateVideo(
  angle: MarketingAngle,
  productImages: string[]
): Promise<VideoGenResult> {
  try {
    const jobId = await initiateVideoGeneration(angle, productImages);
    const completedVideo = await pollForCompletion(jobId);
    validateVideoMetadata(completedVideo);

    totalCost += COST_PER_REQUEST;

    const metadata = {
      duration: completedVideo.duration!,
      resolution: {
        width: completedVideo.resolution!.width,
        height: completedVideo.resolution!.height,
      },
    };

    const confidence = calculateConfidence(completedVideo, metadata);

    const result: VideoGenResult = {
      url: completedVideo.video_url!,
      thumbnailUrl: completedVideo.thumbnail_url!,
      duration: metadata.duration,
      resolution: `${metadata.resolution.width}x${metadata.resolution.height}`,
      format: 'mp4',
      metadata: {
        jobId,
        generatedAt: new Date().toISOString(),
        cost: COST_PER_REQUEST,
        confidence,
        quality: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low',
      },
    };

    return result;
  } catch (error) {
    if (error instanceof VidgoError) {
      throw error;
    }
    throw new VidgoError(
      `Unexpected error during video generation: ${(error as Error).message}`,
      undefined,
      false
    );
  }
}

export { VidgoError };