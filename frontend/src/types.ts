export type ProcessingMode =
  | "CLIENT_SIDE"
  | "SERVER_SIDE"
  | "HYBRID"
  | "EXTERNAL_PROVIDER"
  | string;
export type ProcessingStatus =
  | "IDLE"
  | "QUEUED"
  | "UPLOADING"
  | "ANALYZING"
  | "READY"
  | "DOWNLOADING"
  | "PROCESSING"
  | "FINALIZING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  icon: string;
  inputTypes: string[];
  outputTypes: string[];
  acceptedExtensions?: string[];
  acceptedMimeTypes?: string[];
  processingMode: ProcessingMode;
  engine?: string;
  supportsBatch?: boolean;
  supportsPreview?: boolean;
  keywords: string[];
  popular?: boolean;
  isClientReady?: boolean;
  public?: boolean;
  requiresServer?: boolean;
  serverEngineNotice?: string;
  [key: string]: unknown;
}

export interface DetectedFileInfo {
  file: File;
  name: string;
  size: number;
  formattedSize: string;
  mimeType: string;
  extension: string;
  previewUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  duration?: number;
  formattedDuration?: string;
  recommendedToolIds: string[];
}

export interface ProcessingJob {
  id: string;
  toolId: string;
  toolName?: string;
  status: ProcessingStatus;
  progress: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  stageDescription?: string;
  input?: { file?: File; name?: string; size?: number; mimeType?: string };
  output?: {
    blob?: Blob;
    filename: string;
    size: number;
    mimeType?: string;
    downloadUrl?: string;
    textResult?: string;
    [key: string]: unknown;
  };
  error?: { code?: string; message: string; details?: string };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HistoryItem {
  id: string;
  toolId: string;
  toolName: string;
  inputName: string;
  inputSize?: number;
  outputSize?: number;
  timestamp: number;
  category?: string;
  status: "COMPLETED" | "FAILED" | "CANCELLED";
  outputName?: string;
  completedAt?: number;
  processingLocation: "local" | "server" | "external";
  outputFileId?: string;
  [key: string]: unknown;
}

export interface UserSettings {
  version: 2;
  language: "es" | "en";
  theme: "dark" | "light" | "system";
  imageQuality: number;
  audioBitrate: string;
  videoQuality: "original" | "1080p" | "720p";
  preferLocalProcessing: boolean;
  reducedMotion: boolean;
  saveHistory: boolean;
  confirmBeforeClearHistory: boolean;
}
