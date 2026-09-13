import { EventEmitter } from 'events';
import { JobRecord } from '../types/jobs';
import { logger } from '../utils/logger';

export interface IJobQueue {
  add(jobId: string, data: any): Promise<void>;
  process(handler: (jobId: string, data: any) => Promise<void>): void;
  getWaitingCount(): Promise<number>;
  getActiveCount(): Promise<number>;
  close(): Promise<void>;
}

/**
 * BullMQ-compatible in-memory asynchronous worker queue with concurrency control.
 * Can be swapped directly with BullMQ + Redis in production.
 */
export class InMemoryQueue extends EventEmitter implements IJobQueue {
  private queue: { jobId: string; data: any }[] = [];
  private activeJobs = new Set<string>();
  private handler: ((jobId: string, data: any) => Promise<void>) | null = null;
  private concurrency: number;
  private isProcessing = false;

  constructor(public readonly name: string, concurrency = 2) {
    super();
    this.concurrency = concurrency;
  }

  async add(jobId: string, data: any): Promise<void> {
    this.queue.push({ jobId, data });
    logger.debug(`Queue [${this.name}] added job: ${jobId}. Queue length: ${this.queue.length}`);
    this.tick();
  }

  process(handler: (jobId: string, data: any) => Promise<void>): void {
    this.handler = handler;
    this.tick();
  }

  async getWaitingCount(): Promise<number> {
    return this.queue.length;
  }

  async getActiveCount(): Promise<number> {
    return this.activeJobs.size;
  }

  async close(): Promise<void> {
    this.queue = [];
    this.activeJobs.clear();
  }

  private async tick(): Promise<void> {
    if (!this.handler || this.activeJobs.size >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeJobs.add(item.jobId);

    (async () => {
      try {
        await this.handler!(item.jobId, item.data);
      } catch (err: any) {
        logger.error(`Queue job failed: ${item.jobId}`, err.message);
      } finally {
        this.activeJobs.delete(item.jobId);
        this.tick();
      }
    })();
  }
}
