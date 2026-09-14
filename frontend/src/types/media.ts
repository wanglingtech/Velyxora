export interface MediaFormatOption {
  id: string;
  extension: string;
  label?: string;
  formatNote?: string;
  streamType?: string;
  resolution?: string;
  qualityLabel?: string;
  qualityBadge?: string;
  hasVideo?: boolean;
  hasAudio?: boolean;
  directDownloadUrl?: string;
  type?: "video" | "audio";
  fps?: number;
  bitrate?: number;
  filesize?: number;
  codec?: string;
}

export interface MediaMetadata {
  originalUrl: string;
  platform: string;
  platformLabel: string;
  title: string;
  author: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  formattedDuration?: string;
  contentType?: string;
  availableFormats: MediaFormatOption[];
  requiresServerEngine: boolean;
  id?: string;
  engineDetails: { backendEngine: string; legalNote?: string };
}
