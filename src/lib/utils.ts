import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PipelineSteps } from './types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCost(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function getStepIcon(stepName: string): string {
  const iconMap: Record<string, string> = {
    scraping: '🌐',
    vision: '👁️',
    background: '🎨',
    content: '✍️',
    video: '🎬',
    assembly: '🔧',
    scrape: '🌐',
    parse: '📄',
    analyze: '🧠',
    extract: '🔍',
    process: '⚙️',
    validate: '✅',
    transform: '🔄',
    fetch: '⬇️',
    clean: '🧹',
    format: '📐',
    save: '💾',
    complete: '✓',
    error: '⚠️',
    default: '⭕',
  };

  const normalized = stepName.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (normalized.includes(key)) {
      return icon;
    }
  }

  return iconMap.default;
}

export function getStepDisplayName(stepKey: keyof PipelineSteps): string {
  const displayNames: Record<keyof PipelineSteps, string> = {
    scraping: 'Product Scraping',
    vision: 'Vision Analysis',
    background: 'Background Removal',
    content: 'Content Generation',
    video: 'Video Generation',
    assembly: 'Final Assembly',
  };

  return displayNames[stepKey];
}

export function getStepDescription(stepKey: keyof PipelineSteps): string {
  const descriptions: Record<keyof PipelineSteps, string> = {
    scraping: 'Extracting product data from URL',
    vision: 'Analyzing product images with AI',
    background: 'Removing image backgrounds',
    content: 'Generating marketing scripts',
    video: 'Creating video from script',
    assembly: 'Assembling final video with layers',
  };

  return descriptions[stepKey];
}

export function calculateProgress(steps: PipelineSteps): number {
  const stepKeys: (keyof PipelineSteps)[] = [
    'scraping',
    'vision',
    'background',
    'content',
    'video',
    'assembly',
  ];

  const totalSteps = stepKeys.length;
  let completedSteps = 0;
  let currentProgress = 0;

  for (const key of stepKeys) {
    const step = steps[key];
    if (step.status === 'success') {
      completedSteps++;
    } else if (step.status === 'running') {
      currentProgress = step.progress / 100;
      break;
    } else if (step.status === 'failed') {
      break;
    }
  }

  const overallProgress = ((completedSteps + currentProgress) / totalSteps) * 100;
  return Math.min(Math.round(overallProgress), 100);
}

export function getStatusColor(
  status: 'pending' | 'running' | 'success' | 'failed' | 'retrying'
): string {
  const colorMap: Record<string, string> = {
    pending: 'text-gray-400',
    running: 'text-blue-500',
    success: 'text-green-500',
    failed: 'text-red-500',
    retrying: 'text-yellow-500',
  };

  return colorMap[status] || 'text-gray-400';
}

export function getStatusBgColor(
  status: 'pending' | 'running' | 'success' | 'failed' | 'retrying'
): string {
  const colorMap: Record<string, string> = {
    pending: 'bg-gray-100',
    running: 'bg-blue-100',
    success: 'bg-green-100',
    failed: 'bg-red-100',
    retrying: 'bg-yellow-100',
  };

  return colorMap[status] || 'bg-gray-100';
}

export function estimateTimeRemaining(
  steps: PipelineSteps,
  startTime: string | null
): string | null {
  if (!startTime) return null;

  const stepKeys: (keyof PipelineSteps)[] = [
    'scraping',
    'vision',
    'background',
    'content',
    'video',
    'assembly',
  ];

  const averageStepDuration = 30000;

  let completedCount = 0;
  let remainingCount = 0;
  let foundRunning = false;

  for (const key of stepKeys) {
    const step = steps[key];
    if (step.status === 'success') {
      completedCount++;
    } else if (step.status === 'running') {
      foundRunning = true;
      remainingCount++;
    } else if (foundRunning || step.status === 'pending') {
      remainingCount++;
    }
  }

  if (remainingCount === 0) return null;

  const estimatedMs = remainingCount * averageStepDuration;
  return formatDuration(estimatedMs);
}

export function isProductUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;

  const productPatterns = [
    /amazon\./i,
    /ebay\./i,
    /walmart\./i,
    /target\./i,
    /bestbuy\./i,
    /aliexpress\./i,
    /etsy\./i,
    /shopify\./i,
    /\/product\//i,
    /\/item\//i,
    /\/p\//i,
    /\/dp\//i,
  ];

  return productPatterns.some((pattern) => pattern.test(url));
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

export function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          reject(error);
        } else {
          const delayMs = baseDelay * Math.pow(2, retries - 1);
          await delay(delayMs);
          attempt();
        }
      }
    };

    attempt();
  });
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRan: number | null = null;
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();

    if (lastRan === null || now - lastRan >= limitMs) {
      func(...args);
      lastRan = now;
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          func(...args);
          lastRan = Date.now();
        },
        limitMs - (now - lastRan)
      );
    }
  };
}