// Pipeline types
export interface ProductData {
  name: string;
  price: string;
  currency: string;
  description: string;
  ingredients: string[];
  images: string[];
  reviews: { author: string; rating: number; text: string }[];
  url: string;
  brand: string;
  category: string;
}

export interface VisionAnalysis {
  packagingScore: number; // 1-10
  colorPalette: string[];
  visualHooks: string[];
  productPlacement: string;
  backgroundSuggestion: string;
  tiktokAngle: string;
}

export interface MarketingAngle {
  id: string;
  title: string;
  hook: string; // 2-second TikTok hook
  script: string;
  targetAudience: string;
  tone: string;
  qualityScore: number;
  estimatedEngagement: string;
}

export interface VideoGenResult {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  resolution: string;
  format: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'retrying';
  qualityScore: number | null;
  cost: number;
  startTime: string | null;
  endTime: string | null;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  result: any;
}

export interface PipelineState {
  id: string;
  productUrl: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  steps: PipelineStep[];
  productData: ProductData | null;
  visionAnalysis: VisionAnalysis | null;
  marketingAngles: MarketingAngle[];
  videoResult: VideoGenResult | null;
  finalVideo: { url: string; layers: string[] } | null;
  totalCost: number;
  startTime: string | null;
  endTime: string | null;
  logs: PipelineLog[];
}

export interface PipelineLog {
  timestamp: string;
  step: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}

export interface QualityGate {
  minScore: number;
  maxRetries: number;
  currentRetry: number;
}

export interface CostBreakdown {
  apify: number;
  openai: number;
  mistral: number;
  vidgo: number;
  shotstack: number;
  removebg: number;
  total: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PipelineResponse extends ApiResponse<PipelineState> {
  pipelineId: string;
}

export interface StatusResponse extends ApiResponse<PipelineState> {
  pipelineId: string;
}

// Service-specific types
export interface ApifyScraperResult {
  name: string;
  price: string;
  currency: string;
  description: string;
  images: string[];
  reviews: Array<{
    author: string;
    rating: number;
    text: string;
  }>;
  brand: string;
  category: string;
  ingredients?: string[];
  url: string;
}

export interface OpenAIVisionResponse {
  packagingScore: number;
  colorPalette: string[];
  visualHooks: string[];
  productPlacement: string;
  backgroundSuggestion: string;
  tiktokAngle: string;
  reasoning?: string;
}

export interface MistralScriptResponse {
  angles: Array<{
    id: string;
    title: string;
    hook: string;
    script: string;
    targetAudience: string;
    tone: string;
    qualityScore: number;
    estimatedEngagement: string;
  }>;
}

export interface VidgoGenerationRequest {
  script: string;
  voiceId: string;
  backgroundMusic?: string;
  productImages: string[];
  duration: number;
}

export interface VidgoGenerationResponse {
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  resolution?: string;
}

export interface ShotstackEditRequest {
  timeline: {
    soundtrack?: {
      src: string;
      effect: string;
      volume: number;
    };
    background: string;
    tracks: Array<{
      clips: Array<{
        asset: {
          type: string;
          src: string;
        };
        start: number;
        length: number;
        fit?: string;
        position?: string;
        offset?: {
          x: number;
          y: number;
        };
        scale?: number;
        transition?: {
          in: string;
          out: string;
        };
      }>;
    }>;
  };
  output: {
    format: string;
    resolution: string;
    fps: number;
    quality: string;
  };
}

export interface ShotstackRenderResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    owner: string;
    url: string;
    status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed';
    data: ShotstackEditRequest;
    created: string;
    updated: string;
  };
}

export interface RemoveBgResponse {
  data: {
    result_b64: string;
    foreground_type: string;
    foreground_top: number;
    foreground_left: number;
    foreground_width: number;
    foreground_height: number;
  };
}

// Configuration types
export interface PipelineConfig {
  qualityGates: {
    vision: QualityGate;
    scripts: QualityGate;
    video: QualityGate;
  };
  costs: {
    apify: number;
    openaiVision: number;
    mistralScript: number;
    vidgo: number;
    shotstack: number;
    removebg: number;
  };
  timeouts: {
    scraping: number;
    vision: number;
    scriptGeneration: number;
    videoGeneration: number;
    rendering: number;
  };
}

// Error types
export interface PipelineError extends Error {
  step: string;
  code: string;
  retryable: boolean;
  details?: any;
}

export interface ValidationError extends Error {
  field: string;
  value: any;
  constraints: string[];
}

// Webhook types
export interface WebhookPayload {
  event: 'pipeline.started' | 'pipeline.completed' | 'pipeline.failed' | 'step.completed' | 'step.failed';
  pipelineId: string;
  timestamp: string;
  data: PipelineState | PipelineStep;
}

// Storage types
export interface StoredPipeline {
  id: string;
  state: PipelineState;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// Queue types
export interface QueueJob {
  id: string;
  type: 'pipeline' | 'retry' | 'cleanup';
  priority: number;
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  scheduledFor: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'delayed';
}

// Metrics types
export interface PipelineMetrics {
  pipelineId: string;
  totalDuration: number;
  stepDurations: Record<string, number>;
  retryCount: number;
  qualityScores: Record<string, number>;
  costBreakdown: CostBreakdown;
  timestamp: string;
}

// Video layer types
export interface VideoLayer {
  id: string;
  type: 'product' | 'background' | 'text' | 'overlay' | 'audio';
  src: string;
  start: number;
  duration: number;
  zIndex: number;
  effects?: {
    transition?: string;
    filter?: string;
    animation?: string;
  };
  position?: {
    x: number;
    y: number;
  };
  scale?: number;
  opacity?: number;
}

export interface CompositeVideoRequest {
  layers: VideoLayer[];
  duration: number;
  resolution: string;
  fps: number;
  format: string;
  quality: 'low' | 'medium' | 'high';
}

// TikTok optimization types
export interface TikTokOptimization {
  aspectRatio: '9:16' | '1:1' | '16:9';
  duration: number; // 15-60 seconds
  hookTiming: number; // 0-3 seconds
  callToActionTiming: number; // last 5 seconds
  textOverlays: Array<{
    text: string;
    start: number;
    duration: number;
    position: 'top' | 'center' | 'bottom';
    style: string;
  }>;
  trending: {
    sounds: string[];
    hashtags: string[];
    effects: string[];
  };
}

export interface EngagementPrediction {
  score: number; // 0-100
  views: string; // e.g., "10k-50k"
  likes: string;
  comments: string;
  shares: string;
  completionRate: number; // 0-1
  factors: {
    hook: number;
    pacing: number;
    visualAppeal: number;
    audio: number;
    relevance: number;
  };
}