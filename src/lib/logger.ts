export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  timestamp: string;
  step: string;
  level: LogLevel;
  message: string;
  cost?: number;
  qualityScore?: number;
  data?: any;
}

export interface CostBreakdown {
  step: string;
  cost: number;
  count: number;
}

class PipelineLogger {
  private logs: LogEntry[] = [];

  private createLogEntry(
    step: string,
    level: LogLevel,
    message: string,
    options?: {
      cost?: number;
      qualityScore?: number;
      data?: any;
    }
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      step,
      level,
      message,
    };

    if (options?.cost !== undefined) {
      entry.cost = options.cost;
    }

    if (options?.qualityScore !== undefined) {
      entry.qualityScore = options.qualityScore;
    }

    if (options?.data !== undefined) {
      entry.data = options.data;
    }

    return entry;
  }

  public info(
    step: string,
    message: string,
    options?: {
      cost?: number;
      qualityScore?: number;
      data?: any;
    }
  ): void {
    const entry = this.createLogEntry(step, 'info', message, options);
    this.logs.push(entry);
    console.log(
      `[INFO] [${entry.timestamp}] [${step}] ${message}`,
      options?.data ? options.data : ''
    );
  }

  public warn(
    step: string,
    message: string,
    options?: {
      cost?: number;
      qualityScore?: number;
      data?: any;
    }
  ): void {
    const entry = this.createLogEntry(step, 'warn', message, options);
    this.logs.push(entry);
    console.warn(
      `[WARN] [${entry.timestamp}] [${step}] ${message}`,
      options?.data ? options.data : ''
    );
  }

  public error(
    step: string,
    message: string,
    options?: {
      cost?: number;
      qualityScore?: number;
      data?: any;
    }
  ): void {
    const entry = this.createLogEntry(step, 'error', message, options);
    this.logs.push(entry);
    console.error(
      `[ERROR] [${entry.timestamp}] [${step}] ${message}`,
      options?.data ? options.data : ''
    );
  }

  public success(
    step: string,
    message: string,
    options?: {
      cost?: number;
      qualityScore?: number;
      data?: any;
    }
  ): void {
    const entry = this.createLogEntry(step, 'success', message, options);
    this.logs.push(entry);
    console.log(
      `[SUCCESS] [${entry.timestamp}] [${step}] ${message}`,
      options?.data ? options.data : ''
    );
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getCostBreakdown(): CostBreakdown[] {
    const costMap = new Map<string, { total: number; count: number }>();

    for (const log of this.logs) {
      if (log.cost !== undefined && log.cost > 0) {
        const existing = costMap.get(log.step) || { total: 0, count: 0 };
        existing.total += log.cost;
        existing.count += 1;
        costMap.set(log.step, existing);
      }
    }

    const breakdown: CostBreakdown[] = [];
    for (const [step, { total, count }] of costMap.entries()) {
      breakdown.push({
        step,
        cost: total,
        count,
      });
    }

    return breakdown.sort((a, b) => b.cost - a.cost);
  }

  public getTotalCost(): number {
    return this.logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  }

  public reset(): void {
    this.logs = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public getLogsByStep(step: string): LogEntry[] {
    return this.logs.filter((log) => log.step === step);
  }

  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  public hasErrors(): boolean {
    return this.logs.some((log) => log.level === 'error');
  }

  public getLastError(): LogEntry | null {
    const errors = this.logs.filter((log) => log.level === 'error');
    return errors.length > 0 ? errors[errors.length - 1] : null;
  }

  public getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    totalCost: number;
    averageQualityScore?: number;
  } {
    const byLevel: Record<LogLevel, number> = {
      info: 0,
      warn: 0,
      error: 0,
      success: 0,
    };

    let totalQuality = 0;
    let qualityCount = 0;

    for (const log of this.logs) {
      byLevel[log.level]++;
      if (log.qualityScore !== undefined) {
        totalQuality += log.qualityScore;
        qualityCount++;
      }
    }

    return {
      total: this.logs.length,
      byLevel,
      totalCost: this.getTotalCost(),
      averageQualityScore:
        qualityCount > 0 ? totalQuality / qualityCount : undefined,
    };
  }

  public getRecentLogs(count: number = 10): LogEntry[] {
    return this.logs.slice(-count);
  }

  public clearOldLogs(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge;
    this.logs = this.logs.filter((log) => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= cutoff;
    });
  }

  public addLog(entry: LogEntry): void {
    this.logs.push(entry);
  }

  public groupByStep(): Record<string, LogEntry[]> {
    const grouped: Record<string, LogEntry[]> = {};

    for (const log of this.logs) {
      if (!grouped[log.step]) {
        grouped[log.step] = [];
      }
      grouped[log.step].push(log);
    }

    return grouped;
  }

  public getStepSummary(step: string): {
    total: number;
    byLevel: Record<LogLevel, number>;
    totalCost: number;
    avgQuality?: number;
  } {
    const stepLogs = this.getLogsByStep(step);
    const byLevel: Record<LogLevel, number> = {
      info: 0,
      warn: 0,
      error: 0,
      success: 0,
    };

    let totalCost = 0;
    let totalQuality = 0;
    let qualityCount = 0;

    for (const log of stepLogs) {
      byLevel[log.level]++;
      if (log.cost !== undefined) {
        totalCost += log.cost;
      }
      if (log.qualityScore !== undefined) {
        totalQuality += log.qualityScore;
        qualityCount++;
      }
    }

    return {
      total: stepLogs.length,
      byLevel,
      totalCost,
      avgQuality: qualityCount > 0 ? totalQuality / qualityCount : undefined,
    };
  }
}

export const logger = new PipelineLogger();
export default logger;