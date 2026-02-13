import { v4 as uuidv4 } from 'uuid';
import { PipelineState, PipelineStep, PipelineLog, ProductData, VisionAnalysis, MarketingAngle, VideoGenResult, QualityGate, CostBreakdown } from './types';
import { scrapeProduct } from './pipeline/apify';
import { analyzeProductImage } from './pipeline/vision';
import { generateMarketingAngles } from './pipeline/mistral';
import { generateVideo } from './pipeline/vidgo';
import { assembleVideo } from './pipeline/shotstack';
import { removeBackground } from './pipeline/removebg';
import { PipelineLogger } from './logger';

export class Joker {
  private state: PipelineState;
  private logger: PipelineLogger;
  private onStateChange?: (state: PipelineState) => void;
  private cancelled: boolean = false;
  private retryCount: Map<string, number> = new Map();
  private maxRetries: number = 3;

  constructor(onStateChange?: (state: PipelineState) => void) {
    this.onStateChange = onStateChange;
    this.logger = new PipelineLogger();
    this.state = this.initializeState();
  }

  private initializeState(): PipelineState {
    return {
      id: uuidv4(),
      status: 'idle',
      currentStep: null,
      steps: {
        scraping: { status: 'pending', progress: 0 },
        vision: { status: 'pending', progress: 0 },
        background: { status: 'pending', progress: 0 },
        content: { status: 'pending', progress: 0 },
        video: { status: 'pending', progress: 0 },
        assembly: { status: 'pending', progress: 0 },
      },
      productData: null,
      visionAnalysis: null,
      transparentImageUrl: null,
      marketingAngles: [],
      videoGenResult: null,
      finalVideoUrl: null,
      costs: {
        scraping: 0,
        vision: 0,
        background: 0,
        content: 0,
        video: 0,
        assembly: 0,
        total: 0,
      },
      startedAt: null,
      completedAt: null,
      error: null,
    };
  }

  private updateState(updates: Partial<PipelineState>): void {
    this.state = { ...this.state, ...updates };
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  private updateStep(step: keyof PipelineState['steps'], updates: Partial<PipelineStep>): void {
    this.state.steps[step] = { ...this.state.steps[step], ...updates };
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  private async executeWithRetry<T>(
    stepName: string,
    fn: () => Promise<T>,
    validator?: (result: T) => number
  ): Promise<T> {
    const retries = this.retryCount.get(stepName) || 0;

    try {
      const result = await fn();
      
      if (validator) {
        const qualityScore = validator(result);
        this.logger.info(`Quality score for ${stepName}: ${qualityScore}/10`);
        
        if (qualityScore < 8 && retries < this.maxRetries) {
          this.retryCount.set(stepName, retries + 1);
          this.logger.warn(`Quality below threshold for ${stepName}, retrying (${retries + 1}/${this.maxRetries})`);
          await this.exponentialBackoff(retries);
          return this.executeWithRetry(stepName, fn, validator);
        }
      }

      this.retryCount.set(stepName, 0);
      return result;
    } catch (error) {
      if (retries < this.maxRetries) {
        this.retryCount.set(stepName, retries + 1);
        this.logger.error(`Error in ${stepName}, retrying (${retries + 1}/${this.maxRetries})`, { error });
        await this.exponentialBackoff(retries);
        return this.executeWithRetry(stepName, fn, validator);
      }
      throw error;
    }
  }

  private async exponentialBackoff(retryCount: number): Promise<void> {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private evaluateQuality(step: string, result: any): number {
    switch (step) {
      case 'scraping':
        const productData = result as ProductData;
        let score = 5;
        if (productData.title?.length > 10) score += 1;
        if (productData.description?.length > 50) score += 1;
        if (productData.images?.length > 0) score += 1;
        if (productData.price) score += 1;
        if (productData.features?.length > 0) score += 1;
        return score;
      
      case 'vision':
        const vision = result as VisionAnalysis;
        return vision.confidence >= 0.8 ? 9 : vision.confidence >= 0.6 ? 7 : 5;
      
      case 'content':
        const angles = result as MarketingAngle[];
        return angles.length >= 3 && angles.every(a => a.hook?.length > 10) ? 9 : 7;
      
      case 'video':
        const videoResult = result as VideoGenResult;
        return videoResult.url ? 9 : 5;
      
      default:
        return 8;
    }
  }

  public async run(productUrl: string): Promise<PipelineState> {
    this.cancelled = false;
    this.updateState({ status: 'running', startedAt: Date.now(), error: null });
    this.logger.info('Pipeline started', { productUrl, pipelineId: this.state.id });

    try {
      if (this.cancelled) throw new Error('Pipeline cancelled');
      await this.runScrapingStep(productUrl);

      if (this.cancelled) throw new Error('Pipeline cancelled');
      await this.runVisionStep();

      if (this.cancelled) throw new Error('Pipeline cancelled');
      await this.runBackgroundRemovalStep();

      if (this.cancelled) throw new Error('Pipeline cancelled');
      await this.runContentGenerationStep();

      if (this.cancelled) throw new Error('Pipeline cancelled');
      await this.runVideoGenerationStep();

      if (this.cancelled) throw new Error('Pipeline cancelled');
      await this.runAssemblyStep();

      this.updateState({ status: 'completed', completedAt: Date.now() });
      this.logger.info('Pipeline completed successfully', { pipelineId: this.state.id });
      return this.state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateState({ status: 'failed', error: errorMessage, completedAt: Date.now() });
      this.logger.error('Pipeline failed', { error: errorMessage, pipelineId: this.state.id });
      throw error;
    }
  }

  private async runScrapingStep(productUrl: string): Promise<void> {
    this.updateState({ currentStep: 'scraping' });
    this.updateStep('scraping', { status: 'running', startedAt: Date.now() });
    this.logger.info('Starting scraping step', { productUrl });

    try {
      const productData = await this.executeWithRetry(
        'scraping',
        () => scrapeProduct(productUrl),
        (result) => this.evaluateQuality('scraping', result)
      );

      this.updateState({ productData });
      this.state.costs.scraping = 0.05;
      this.state.costs.total += 0.05;
      this.updateStep('scraping', { status: 'completed', progress: 100, completedAt: Date.now() });
      this.logger.info('Scraping step completed', { productData });
    } catch (error) {
      this.updateStep('scraping', { status: 'failed', error: error instanceof Error ? error.message : 'Scraping failed' });
      throw error;
    }
  }

  private async runVisionStep(): Promise<void> {
    if (!this.state.productData?.images?.[0]) throw new Error('No product image available');
    
    this.updateState({ currentStep: 'vision' });
    this.updateStep('vision', { status: 'running', startedAt: Date.now() });
    this.logger.info('Starting vision analysis step');

    try {
      const visionAnalysis = await this.executeWithRetry(
        'vision',
        () => analyzeProductImage(this.state.productData!.images[0]),
        (result) => this.evaluateQuality('vision', result)
      );

      this.updateState({ visionAnalysis });
      this.state.costs.vision = 0.02;
      this.state.costs.total += 0.02;
      this.updateStep('vision', { status: 'completed', progress: 100, completedAt: Date.now() });
      this.logger.info('Vision analysis completed', { visionAnalysis });
    } catch (error) {
      this.updateStep('vision', { status: 'failed', error: error instanceof Error ? error.message : 'Vision analysis failed' });
      throw error;
    }
  }

  private async runBackgroundRemovalStep(): Promise<void> {
    if (!this.state.productData?.images?.[0]) throw new Error('No product image available');
    
    this.updateState({ currentStep: 'background' });
    this.updateStep('background', { status: 'running', startedAt: Date.now() });
    this.logger.info('Starting background removal step');

    try {
      const transparentImageUrl = await this.executeWithRetry(
        'background',
        () => removeBackground(this.state.productData!.images[0])
      );

      this.updateState({ transparentImageUrl });
      this.state.costs.background = 0.10;
      this.state.costs.total += 0.10;
      this.updateStep('background', { status: 'completed', progress: 100, completedAt: Date.now() });
      this.logger.info('Background removal completed');
    } catch (error) {
      this.updateStep('background', { status: 'failed', error: error instanceof Error ? error.message : 'Background removal failed' });
      throw error;
    }
  }

  private async runContentGenerationStep(): Promise<void> {
    if (!this.state.productData || !this.state.visionAnalysis) throw new Error('Missing required data for content generation');
    
    this.updateState({ currentStep: 'content' });
    this.updateStep('content', { status: 'running', startedAt: Date.now() });
    this.logger.info('Starting content generation step');

    try {
      const marketingAngles = await this.executeWithRetry(
        'content',
        () => generateMarketingAngles(this.state.productData!, this.state.visionAnalysis!),
        (result) => this.evaluateQuality('content', result)
      );

      this.updateState({ marketingAngles });
      this.state.costs.content = 0.03;
      this.state.costs.total += 0.03;
      this.updateStep('content', { status: 'completed', progress: 100, completedAt: Date.now() });
      this.logger.info('Content generation completed', { anglesCount: marketingAngles.length });
    } catch (error) {
      this.updateStep('content', { status: 'failed', error: error instanceof Error ? error.message : 'Content generation failed' });
      throw error;
    }
  }

  private async runVideoGenerationStep(): Promise<void> {
    if (!this.state.marketingAngles?.[0]) throw new Error('No marketing angles available');
    
    this.updateState({ currentStep: 'video' });
    this.updateStep('video', { status: 'running', startedAt: Date.now() });
    this.logger.info('Starting video generation step');

    try {
      const videoGenResult = await this.executeWithRetry(
        'video',
        () => generateVideo(this.state.marketingAngles![0]),
        (result) => this.evaluateQuality('video', result)
      );

      this.updateState({ videoGenResult });
      this.state.costs.video = 0.50;
      this.state.costs.total += 0.50;
      this.updateStep('video', { status: 'completed', progress: 100, completedAt: Date.now() });
      this.logger.info('Video generation completed');
    } catch (error) {
      this.updateStep('video', { status: 'failed', error: error instanceof Error ? error.message : 'Video generation failed' });
      throw error;
    }
  }

  private async runAssemblyStep(): Promise<void> {
    if (!this.state.videoGenResult || !this.state.transparentImageUrl) throw new Error('Missing required assets for assembly');
    
    this.updateState({ currentStep: 'assembly' });
    this.updateStep('assembly', { status: 'running', startedAt: Date.now() });
    this.logger.info('Starting video assembly step');

    try {
      const finalVideoUrl = await this.executeWithRetry(
        'assembly',
        () => assembleVideo({
          backgroundVideoUrl: this.state.videoGenResult!.url,
          productImageUrl: this.state.transparentImageUrl!,
          script: this.state.marketingAngles![0],
        })
      );

      this.updateState({ finalVideoUrl });
      this.state.costs.assembly = 0.30;
      this.state.costs.total += 0.30;
      this.updateStep('assembly', { status: 'completed', progress: 100, completedAt: Date.now() });
      this.logger.info('Video assembly completed', { finalVideoUrl });
    } catch (error) {
      this.updateStep('assembly', { status: 'failed', error: error instanceof Error ? error.message : 'Video assembly failed' });
      throw error;
    }
  }

  public getState(): PipelineState {
    return this.state;
  }

  public getLogs(): PipelineLog[] {
    return this.logger.getLogs();
  }

  public getCostBreakdown(): CostBreakdown {
    return this.state.costs;
  }

  public cancel(): void {
    this.cancelled = true;
    this.updateState({ status: 'cancelled', completedAt: Date.now() });
    this.logger.warn('Pipeline cancelled by user', { pipelineId: this.state.id });
  }
}