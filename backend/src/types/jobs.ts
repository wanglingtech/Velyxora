export type JobStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'UPLOADING'
  | 'ANALYZING'
  | 'PROCESSING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface JobRecord {
  id: string;
  toolId: string;
  toolName?: string;
  status: JobStatus;
  progress: number; // -1 for indeterminate, 0..100 for exact
  progressMessage?: string;
  input: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
  };
  output?: {
    fileId: string;
    filename: string;
    mimeType: string;
    size: number;
    path: string;
    downloadUrl: string;
  };
  options?: Record<string, any>;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
}
