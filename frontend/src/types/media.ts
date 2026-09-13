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
  availableFormats: MediaFormatOption[];
  requiresServerEngine: boolean;
  id?: string;
  engineDetails: { backendEngine: string; legalNote?: string };
}
