import axios, { AxiosInstance } from 'axios';

interface AssembleVideoParams {
  videoUrl: string;
  productImageUrl: string;
  transparentProductUrl: string;
  script: string;
  hook: string;
}

interface AssembleVideoResult {
  url: string;
  layers: string[];
}

interface ShotstackClip {
  asset: {
    type: string;
    src: string;
    volume?: number;
    trim?: number;
  };
  start: number;
  length: number;
  fit?: string;
  scale?: number;
  position?: string;
  offset?: {
    x?: number;
    y?: number;
  };
}

interface ShotstackTrack {
  clips: ShotstackClip[];
}

interface ShotstackTimeline {
  tracks: ShotstackTrack[];
}

interface ShotstackOutput {
  format: string;
  resolution: string;
  fps?: number;
  quality?: string;
}

interface ShotstackRenderRequest {
  timeline: ShotstackTimeline;
  output: ShotstackOutput;
}

interface ShotstackRenderResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    message: string;
  };
}

interface ShotstackStatusResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed';
    url?: string;
    error?: string;
  };
}

const SHOTSTACK_API_URL = 'https://api.shotstack.io/edit/v1';
const MAX_RETRIES = 3;
const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 300000;

class ShotstackClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: SHOTSTACK_API_URL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async render(request: ShotstackRenderRequest): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.post<ShotstackRenderResponse>(
          '/render',
          request
        );

        if (!response.data.success) {
          throw new Error(`Shotstack render failed: ${response.data.message}`);
        }

        return response.data.response.id;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < MAX_RETRIES - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Failed to submit render after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  async pollRenderStatus(renderId: string): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLL_TIME) {
      try {
        const response = await this.client.get<ShotstackStatusResponse>(
          `/render/${renderId}`
        );

        if (!response.data.success) {
          throw new Error(`Status check failed: ${response.data.message}`);
        }

        const { status, url, error } = response.data.response;

        if (status === 'done') {
          if (!url) {
            throw new Error('Render completed but no URL returned');
          }
          return url;
        }

        if (status === 'failed') {
          throw new Error(`Render failed: ${error || 'Unknown error'}`);
        }

        await this.delay(POLL_INTERVAL);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          await this.delay(POLL_INTERVAL);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Render timeout after ${MAX_POLL_TIME / 1000} seconds`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function createTimeline(params: {
  videoUrl: string;
  productImageUrl: string;
  transparentProductUrl: string;
  script: string;
  hook: string;
  videoDuration: number;
}): ShotstackTimeline {
  const { videoUrl, transparentProductUrl, hook, script, videoDuration } = params;

  const tracks: ShotstackTrack[] = [];

  tracks.push({
    clips: [
      {
        asset: {
          type: 'video',
          src: videoUrl,
          volume: 1,
        },
        start: 0,
        length: videoDuration,
        fit: 'crop',
      },
    ],
  });

  tracks.push({
    clips: [
      {
        asset: {
          type: 'image',
          src: transparentProductUrl,
        },
        start: 0,
        length: videoDuration,
        fit: 'none',
        scale: 0.3,
        position: 'bottomRight',
        offset: {
          x: -0.05,
          y: -0.05,
        },
      },
    ],
  });

  if (hook && hook.trim()) {
    tracks.push({
      clips: [
        {
          asset: {
            type: 'html',
            src: `<div style="font-family: Arial, sans-serif; font-size: 48px; font-weight: bold; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); padding: 20px; text-align: center;">${escapeHtml(hook)}</div>`,
          },
          start: 0,
          length: 2,
          position: 'top',
          offset: {
            y: 0.1,
          },
        },
      ],
    });
  }

  if (script && script.trim()) {
    const sentences = script.split(/[.!?]+/).filter(s => s.trim());
    const sentenceDuration = Math.max(2, videoDuration / sentences.length);

    const captionClips: ShotstackClip[] = sentences.map((sentence, index) => ({
      asset: {
        type: 'html',
        src: `<div style="font-family: Arial, sans-serif; font-size: 36px; color: white; background: rgba(0,0,0,0.7); padding: 15px 30px; border-radius: 8px; text-align: center;">${escapeHtml(sentence.trim())}</div>`,
      },
      start: index * sentenceDuration,
      length: Math.min(sentenceDuration, videoDuration - index * sentenceDuration),
      position: 'bottom',
      offset: {
        y: -0.15,
      },
    }));

    tracks.push({
      clips: captionClips,
    });
  }

  return { tracks };
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export async function assembleVideo(params: AssembleVideoParams): Promise<AssembleVideoResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY;

  if (!apiKey) {
    throw new Error('SHOTSTACK_API_KEY environment variable is required');
  }

  const client = new ShotstackClient(apiKey);

  let videoDuration = 15;
  try {
    const headResponse = await axios.head(params.videoUrl, { timeout: 5000 });
    const contentLength = headResponse.headers['content-length'];
    if (contentLength) {
      videoDuration = Math.min(30, Math.max(10, parseInt(contentLength) / 500000));
    }
  } catch (error) {
    console.warn('Could not determine video duration, using default:', error);
  }

  const timeline = createTimeline({
    videoUrl: params.videoUrl,
    productImageUrl: params.productImageUrl,
    transparentProductUrl: params.transparentProductUrl,
    script: params.script,
    hook: params.hook,
    videoDuration,
  });

  const renderRequest: ShotstackRenderRequest = {
    timeline,
    output: {
      format: 'mp4',
      resolution: '1080x1920',
      fps: 30,
      quality: 'high',
    },
  };

  const renderId = await client.render(renderRequest);
  const url = await client.pollRenderStatus(renderId);

  const layers = [
    'base_video',
    'product_overlay',
    hook ? 'hook_text' : '',
    params.script ? 'captions' : '',
  ].filter(Boolean);

  return {
    url,
    layers,
  };
}