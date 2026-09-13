import { ProcessingJob, ProcessingStatus } from "../types";

type Listener = (job: ProcessingJob) => void;
const listeners = new Set<Listener>();
const jobs = new Map<string, ProcessingJob>();

const publish = (job: ProcessingJob): void => {
  jobs.set(job.id, job);
  listeners.forEach((listener) => listener(job));
};

export const jobService = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  createJob(
    toolId: string,
    toolName: string,
    input?: { name?: string; size?: number; mimeType?: string; file?: File },
  ): ProcessingJob {
    const job: ProcessingJob = {
      id: crypto.randomUUID(),
      toolId,
      toolName,
      status: "IDLE",
      progress: 0,
      createdAt: Date.now(),
      stageDescription: "Preparando...",
      input,
    };
    publish(job);
    return job;
  },
  updateStatus(
    id: string,
    status: ProcessingStatus,
    stageDescription: string,
    progress: number,
  ): void {
    const job = jobs.get(id);
    if (!job) return;
    const now = Date.now();
    publish({
      ...job,
      status,
      stageDescription,
      progress,
      startedAt:
        job.startedAt ||
        (status !== "IDLE" && status !== "QUEUED" ? now : undefined),
      finishedAt:
        status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
          ? now
          : job.finishedAt,
    });
  },
  completeJob(id: string, output: ProcessingJob["output"]): void {
    const job = jobs.get(id);
    if (!job) return;
    publish({
      ...job,
      status: "COMPLETED",
      progress: 100,
      stageDescription: "Completado",
      finishedAt: Date.now(),
      output,
    });
  },
  failJob(
    id: string,
    error: { code?: string; message: string; details?: string },
  ): void {
    const job = jobs.get(id);
    if (!job) return;
    publish({
      ...job,
      status: "FAILED",
      stageDescription: "Fallido",
      finishedAt: Date.now(),
      error,
    });
  },
  cancelJob(id: string): void {
    const job = jobs.get(id);
    if (!job) return;
    publish({
      ...job,
      status: "CANCELLED",
      stageDescription: "Cancelado",
      finishedAt: Date.now(),
    });
  },
};
