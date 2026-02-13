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
  packagingScore: number;
  colorPalette: string[];
  visualHooks: string[];
  productPlacement: string;
  backgroundSuggestion: string;
  tiktokAngle: string;
}

export interface MarketingAngle {
  id: string;
  title: string;
  hook: string;
  script: string;
  targetAudience: string;
  tone: string;
  qualityScore: number;
  estimatedEngagement: string;
}

export interface VideoGenResult {
  url: string;
  thumbnailUrl: string;
  duration: number;
  resolution: string;
  format: string;
}

export interface PipelineStepStatus {
  status: 'pending' | 'running' | 'success' | 'failed' | 'retrying';
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface PipelineSteps {
  scraping: PipelineStepStatus;
  vision: PipelineStepStatus;
  background: PipelineStepStatus;
  content: PipelineStepStatus;
  video: PipelineStepStatus;
  assembly: PipelineStepStatus;
}

export interface CostBreakdown {
  scraping: number;
  vision: number;
  background: number;
  content: number;
  video: number;
  assembly: number;
  total: number;
}

export interface PipelineState {
  id: string;
  productUrl: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentStep: keyof PipelineSteps | null;
  steps: PipelineSteps;
  productData: ProductData | null;
  visionAnalysis: VisionAnalysis | null;
  marketingAngles: MarketingAngle[];
  videoResult: VideoGenResult | null;
  finalVideo: { url: string; layers: string[] } | null;
  costs: CostBreakdown;
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

export interface WebhookPayload {
  event: 'pipeline.started' | 'pipeline.completed' | 'pipeline.failed' | 'step.completed' | 'step.failed';
  pipelineId: string;
  timestamp: string;
  data: PipelineState | PipelineStepStatus;
}

export interface StoredPipeline {
  id: string;
  state: PipelineState;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

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

export interface PipelineMetrics {
  pipelineId: string;
  totalDuration: number;
  stepDurations: Record<string, number>;
  retryCount: number;
  qualityScores: Record<string, number>;
  costBreakdown: CostBreakdown;
  timestamp: string;
}

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

export interface TikTokOptimization {
  aspectRatio: '9:16' | '1:1' | '16:9';
  duration: number;
  hookTiming: number;
  callToActionTiming: number;
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
  score: number;
  views: string;
  likes: string;
  comments: string;
  shares: string;
  completionRate: number;
  factors: {
    hook: number;
    pacing: number;
    visualAppeal: number;
    audio: number;
    relevance: number;
  };
}

export function createInitialPipelineState(productUrl: string): PipelineState {
  return {
    id: Math.random().toString(36).substring(2, 11),
    productUrl,
    status: 'idle',
    currentStep: null,
    steps: {
      scraping: {
        status: 'pending',
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      vision: {
        status: 'pending',
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      background: {
        status: 'pending',
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      content: {
        status: 'pending',
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      video: {
        status: 'pending',
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      assembly: {
        status: 'pending',
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
      },
    },
    productData: null,
    visionAnalysis: null,
    marketingAngles: [],
    videoResult: null,
    finalVideo: null,
    costs: {
      apify: 0,
      openai: 0,
      mistral: 0,
      vidgo: 0,
      shotstack: 0,
      removebg: 0,
      total: 0,
    },
    totalCost: 0,
    startTime: null,
    endTime: null,
    logs: [],
  };
}

export function updateStepStatus(
  state: PipelineState,
  step: keyof PipelineSteps,
  status: PipelineStepStatus['status'],
  progress: number = 0,
  error: string | null = null
): PipelineState {
  const now = new Date().toISOString();
  const updatedStep: PipelineStepStatus = {
    ...state.steps[step],
    status,
    progress,
    error,
  };

  if (status === 'running' && !state.steps[step].startedAt) {
    updatedStep.startedAt = now;
  }

  if (status === 'success' || status === 'failed') {
    updatedStep.completedAt = now;
    updatedStep.progress = 100;
  }

  return {
    ...state,
    currentStep: status === 'running' ? step : state.currentStep,
    steps: {
      ...state.steps,
      [step]: updatedStep,
    },
  };
}

export function addPipelineLog(
  state: PipelineState,
  step: string,
  level: PipelineLog['level'],
  message: string,
  data?: any
): PipelineState {
  const log: PipelineLog = {
    timestamp: new Date().toISOString(),
    step,
    level,
    message,
    data,
  };

  return {
    ...state,
    logs: [...state.logs, log],
  };
}

export function updateCosts(
  state: PipelineState,
  costUpdates: Partial<CostBreakdown>
): PipelineState {
  const updatedCosts = {
    ...state.costs,
    ...costUpdates,
  };

  updatedCosts.total =
    updatedCosts.apify +
    updatedCosts.openai +
    updatedCosts.mistral +
    updatedCosts.vidgo +
    updatedCosts.shotstack +
    updatedCosts.removebg;

  return {
    ...state,
    costs: updatedCosts,
    totalCost: updatedCosts.total,
  };
}