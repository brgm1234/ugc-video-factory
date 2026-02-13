import { scrapeProduct } from './pipeline/apify';
import { analyzeProductImage } from './pipeline/vision';
import { generateMarketingAngles } from './pipeline/mistral';
import { removeBackground } from './pipeline/removebg';
import { generateVideo } from './pipeline/vidgo';
import { assembleVideo } from './pipeline/shotstack';
import { PipelineLogger } from './logger';
import type {
  PipelineState,
  PipelineStepStatus,
  PipelineSteps,
  ProductData,
  VisionAnalysis,
  MarketingAngle,
  VideoGenResult,
  QualityGate,
  CostBreakdown
} from './types';

interface JokerOptions {
  productUrl: string;
  onStateChange?: (state: PipelineState) => void;
  maxRetries?: number;
  qualityThreshold?: number;
}

export class Joker {
  private productUrl: string;
  private onStateChange?: (state: PipelineState) => void;
  private maxRetries: number;
  private qualityThreshold: number;
  private logger: PipelineLogger;
  private state: PipelineState;
  private cancelled: boolean = false;

  constructor(options: JokerOptions) {
    this.productUrl = options.productUrl;
    this.onStateChange = options.onStateChange;
    this.maxRetries = options.maxRetries ?? 3;
    this.qualityThreshold = options.qualityThreshold ?? 0.7;
    this.logger = new PipelineLogger();

    this.state = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      productUrl: this.productUrl,
      status: 'idle',
      currentStep: null,
      steps: {
        scraping: { status: 'pending', progress: 0, startedAt: null, completedAt: null, error: null },
        vision: { status: 'pending', progress: 0, startedAt: null, completedAt: null, error: null },
        background: { status: 'pending', progress: 0, startedAt: null, completedAt: null, error: null },
        content: { status: 'pending', progress: 0, startedAt: null, completedAt: null, error: null },
        video: { status: 'pending', progress: 0, startedAt: null, completedAt: null, error: null },
        assembly: { status: 'pending', progress: 0, startedAt: null, completedAt: null, error: null },
      },
      productData: null,
      visionAnalysis: null,
      marketingAngles: [],
      videoResult: null,
      finalVideo: null,
      costs: {
        scraping: 0,
        vision: 0,
        background: 0,
        content: 0,
        video: 0,
        assembly: 0,
        total: 0,
      },
      totalCost: 0,
      startTime: new Date().toISOString(),
      endTime: null,
      logs: [],
    };
  }

  private emitStateChange(): void {
    this.state.logs = this.logger.getLogs();
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  private updateStepStatus(
    step: keyof PipelineSteps,
    status: PipelineStepStatus,
    progress: number,
    error?: string
  ): void {
    this.state.steps[step] = { status, progress, error };
    this.state.currentStep = step;
    this.emitStateChange();
  }

  private addCost(step: keyof CostBreakdown, cost: number): void {
    this.state.costs[step] += cost;
    this.state.costs.total += cost;
    this.emitStateChange();
  }

  private addQualityGate(gate: QualityGate): void {
    this.state.qualityGates.push(gate);
    this.emitStateChange();
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    stepName: string,
    maxAttempts: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(stepName as keyof PipelineSteps, `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

        if (attempt < maxAttempts) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.info(stepName as keyof PipelineSteps, `Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error(`${stepName} failed after ${maxAttempts} attempts`);
  }

  private checkCancelled(): void {
    if (this.cancelled) {
      throw new Error('Pipeline cancelled');
    }
  }

  async run(): Promise<PipelineState> {
    try {
      this.logger.info('scraping', 'Starting pipeline', { productUrl: this.productUrl });

      // Step 1: Scraping
      this.checkCancelled();
      this.updateStepStatus('scraping', 'running', 0);
      this.logger.info('scraping', 'Scraping product data...');

      const scrapingResult = await this.retryWithBackoff(
        () => scrapeProduct(this.productUrl),
        'scraping'
      );

      this.state.productData = scrapingResult.data;
      this.addCost('scraping', scrapingResult.cost);
      this.addQualityGate({
        step: 'scraping',
        passed: scrapingResult.confidence >= this.qualityThreshold,
        confidence: scrapingResult.confidence,
        threshold: this.qualityThreshold
      });

      this.updateStepStatus('scraping', 'completed', 100);
      this.logger.success('scraping', 'Product data scraped', {
        title: scrapingResult.data.title,
        images: scrapingResult.data.images.length,
        confidence: scrapingResult.confidence
      });

      // Step 2: Vision Analysis
      this.checkCancelled();
      this.updateStepStatus('vision', 'running', 0);
      this.logger.info('vision', 'Analyzing product images...');

      const visionResult = await this.retryWithBackoff(
        () => analyzeProductImage(scrapingResult.data.images, scrapingResult.data),
        'vision'
      );

      this.state.visionAnalysis = visionResult.data;
      this.addCost('vision', visionResult.cost);
      this.addQualityGate({
        step: 'vision',
        passed: visionResult.confidence >= this.qualityThreshold,
        confidence: visionResult.confidence,
        threshold: this.qualityThreshold
      });

      this.updateStepStatus('vision', 'completed', 100);
      this.logger.success('vision', 'Vision analysis completed', {
        features: visionResult.data.features.length,
        confidence: visionResult.confidence
      });

      // Step 3: Background Removal (with graceful degradation)
      this.checkCancelled();
      this.updateStepStatus('background', 'running', 0);
      this.logger.info('background', 'Removing background from primary image...');

      let transparentUrl: string | undefined;
      try {
        const bgResult = await this.retryWithBackoff(
          () => removeBackground(scrapingResult.data.images[0]),
          'background',
          2 // Lower retry count for optional step
        );

        transparentUrl = bgResult.url;
        this.state.transparentImageUrl = transparentUrl;
        this.addCost('background', bgResult.cost);
        this.updateStepStatus('background', 'completed', 100);
        this.logger.success('background', 'Background removed successfully');
      } catch (error) {
        this.logger.warn('background', 'Background removal failed, continuing with original image', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.updateStepStatus('background', 'completed', 100);
      }

      // Step 4: Content Generation (Marketing Angles)
      this.checkCancelled();

      // Quality gate check before expensive operations
      const visionGate = this.state.qualityGates.find(g => g.step === 'vision');
      if (visionGate && !visionGate.passed) {
        this.logger.warn('content', 'Vision quality below threshold, but continuing...');
      }

      this.updateStepStatus('content', 'running', 0);
      this.logger.info('content', 'Generating marketing angles...');

      const contentResult = await this.retryWithBackoff(
        () => generateMarketingAngles(scrapingResult.data, visionResult.data),
        'content'
      );

      this.state.marketingAngles = contentResult.data;
      this.addCost('content', contentResult.cost);
      this.addQualityGate({
        step: 'content',
        passed: contentResult.confidence >= this.qualityThreshold,
        confidence: contentResult.confidence,
        threshold: this.qualityThreshold
      });

      this.updateStepStatus('content', 'completed', 100);
      this.logger.success('content', 'Marketing angles generated', {
        count: contentResult.data.length,
        confidence: contentResult.confidence
      });

      // Step 5: Video Generation
      this.checkCancelled();

      // Quality gate check before video generation
      const contentGate = this.state.qualityGates.find(g => g.step === 'content');
      if (contentGate && !contentGate.passed) {
        throw new Error(`Content quality (${contentGate.confidence.toFixed(2)}) below threshold (${this.qualityThreshold}). Stopping before expensive video generation.`);
      }

      this.updateStepStatus('video', 'running', 0);
      this.logger.info('video', 'Generating video content...');

      // Use the best marketing angle (first one, as they're sorted by score)
      const primaryAngle = contentResult.data[0];
      if (!primaryAngle) {
        throw new Error('No marketing angles generated');
      }

      const videoResult = await this.retryWithBackoff(
        () => generateVideo(
          primaryAngle,
          scrapingResult.data.images,
          transparentUrl
        ),
        'video'
      );

      this.state.videoResult = videoResult.data;
      this.addCost('video', videoResult.cost);

      this.updateStepStatus('video', 'completed', 100);
      this.logger.success('video', 'Video generated', {
        url: videoResult.data.url,
        duration: videoResult.data.duration
      });

      // Step 6: Video Assembly
      this.checkCancelled();
      this.updateStepStatus('assembly', 'running', 0);
      this.logger.info('assembly', 'Assembling final video...');

      const assemblyResult = await this.retryWithBackoff(
        () => assembleVideo(
          videoResult.data.url,
          videoResult.data.overlays,
          videoResult.data.music
        ),
        'assembly'
      );

      this.state.finalVideoUrl = assemblyResult.url;
      this.addCost('assembly', assemblyResult.cost);

      this.updateStepStatus('assembly', 'completed', 100);
      this.logger.success('assembly', 'Video assembly completed', {
        url: assemblyResult.url
      });

      // Pipeline completed
      this.state.endTime = Date.now();
      const duration = this.state.endTime - this.state.startTime;
      this.logger.success('assembly', 'Pipeline completed successfully', {
        duration: `${(duration / 1000).toFixed(2)}s`,
        totalCost: `$${this.state.costs.total.toFixed(4)}`
      });

      this.emitStateChange();
      return this.state;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const currentStep = this.state.currentStep;

      this.logger.error(currentStep, 'Pipeline failed', { error: errorMessage });
      this.updateStepStatus(currentStep, 'failed', this.state.steps[currentStep].progress, errorMessage);

      this.state.endTime = Date.now();
      this.state.error = errorMessage;
      this.emitStateChange();

      throw error;
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.logger.warn(this.state.currentStep, 'Pipeline cancellation requested');
    this.emitStateChange();
  }

  getState(): PipelineState {
    return { ...this.state };
  }

  getCosts(): CostBreakdown {
    return { ...this.state.costs };
  }

  getQualityGates(): QualityGate[] {
    return [...this.state.qualityGates];
  }
}