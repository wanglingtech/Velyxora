import { jobManager } from '../jobs/JobManager';
import { JobRecord } from '../types/jobs';
import { storageService } from './storageService';

class JobService {
  getJob(id: string): JobRecord | undefined {
    return jobManager.getJob(id);
  }

  cancelJob(id: string): boolean {
    return jobManager.requestCancellation(id);
  }

  deleteJob(id: string): boolean {
    const job = jobManager.getJob(id);
    if (job?.output?.fileId) {
      storageService.deleteFile(job.output.fileId);
    }
    return jobManager.deleteJob(id);
  }
}

export const jobService = new JobService();
