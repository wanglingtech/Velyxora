export type MediaPlatform =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'reddit'
  | 'twitter'
  | 'twitch'
  | 'soundcloud'
  | 'pinterest'
  | 'generic';

export type MediaStreamType = 'video' | 'audio' | 'image';

export interface MediaStreamFormat {
  formatId: string;
  type: MediaStreamType;
  container: string;
  extension: string;
  resolution?: string;
  qualityLabel?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  estimatedSize?: number;
  codec?: string;
  fps?: number;
  bitrate?: number;
}

export interface MediaAnalysisResult {
  url: string;
  platform: MediaPlatform;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  contentType?: MediaStreamType | string;
  embedHtml?: string;
  formats: MediaStreamFormat[];
  isDirectDownloadPossible: boolean;
  requiresExternalExtractor: boolean;
  notice?: string;
}
