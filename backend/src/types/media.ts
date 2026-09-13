export type MediaPlatform =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'reddit'
  | 'twitter'
  | 'pinterest'
  | 'generic';

export interface MediaStreamFormat {
  formatId: string;
  extension: string;
  resolution?: string;
  qualityLabel?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  estimatedSize?: number;
  codec?: string;
  url?: string;
}

export interface MediaAnalysisResult {
  url: string;
  platform: MediaPlatform;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  embedHtml?: string;
  formats: MediaStreamFormat[];
  isDirectDownloadPossible: boolean;
  requiresExternalExtractor: boolean;
  notice?: string;
}
