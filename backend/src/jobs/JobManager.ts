import { JobRecord, JobStatus } from '../types/jobs';
import { logger } from '../utils/logger';

class JobManager {
  private jobs = new Map<string, JobRecord>();
  private cancellation = new Map<string, AbortController>();

  createJob(params: {
    id: string;
    ownerId?: string;
    toolId: string;
    toolName?: string;
    input: JobRecord['input'];
    options?: Record<string, any>;
  }): JobRecord {
    const job: JobRecord = {
      id: params.id,
      ownerId: params.ownerId,
      toolId: params.toolId,
      toolName: params.toolName,
      status: 'QUEUED',
      progress: 0,
      input: params.input,
      options: params.options,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(job.id, job);
    this.cancellation.set(job.id, new AbortController());
    logger.info(`Job created: [${job.id}] for tool ${job.toolId}`);
    return job;
  }

  getJob(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  getSignal(id: string): AbortSignal | undefined {
    return this.cancellation.get(id)?.signal;
  }

  requestCancellation(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) return false;
    this.cancellation.get(id)?.abort();
    this.setStatus(id, 'CANCELLED');
    return true;
  }

  updateJob(id: string, updates: Partial<JobRecord>): JobRecord | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    Object.assign(job, updates);
    return job;
  }

  updateProgress(id: string, progress: number, message?: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.progress = progress;
    if (message) job.progressMessage = message;
  }

  setStatus(id: string, status: JobStatus, error?: string): void {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = status;
    if (status === 'PROCESSING' && !job.startedAt) {
      job.startedAt = new Date().toISOString();
    }
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      job.finishedAt = new Date().toISOString();
    }
    if (error) {
      job.error = error;
    }
    logger.info(`Job [${id}] status changed to ${status}`);
  }

  deleteJob(id: string): boolean {
    this.cancellation.delete(id);
    return this.jobs.delete(id);
  }

  listJobs(): JobRecord[] {
    return Array.from(this.jobs.values());
  }
}

export const jobManager = new JobManager();
