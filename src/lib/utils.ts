import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCost(amount: number): string {
  return `$${amount.toFixed(2)}`;
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
  return Math.random().toString(36).substring(2, 11);
}

export function getStepIcon(stepName: string): string {
  const iconMap: Record<string, string> = {
    scrape: 'globe',
    parse: 'file-text',
    analyze: 'brain',
    extract: 'search',
    process: 'cpu',
    validate: 'check-circle',
    transform: 'shuffle',
    fetch: 'download',
    clean: 'filter',
    format: 'layout',
    save: 'save',
    complete: 'check',
    error: 'alert-circle',
    default: 'circle',
  };

  const normalized = stepName.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (normalized.includes(key)) {
      return icon;
    }
  }

  return iconMap.default;
}