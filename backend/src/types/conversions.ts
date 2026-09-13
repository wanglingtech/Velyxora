export interface ConversionOptions {
  targetFormat: string;
  quality?: number; // 1-100
  resolution?: string; // e.g. "1920x1080"
  bitrate?: string; // e.g. "320k", "192k"
  sampleRate?: number; // e.g. 44100, 48000
  channels?: number; // 1 (mono), 2 (stereo)
  fps?: number;
  trimStart?: number; // seconds
  trimEnd?: number; // seconds
  muteAudio?: boolean;
  watermarkText?: string;
  speedMultiplier?: number;
  normalizeAudio?: boolean;
  scale?: number;
}

export interface ConversionResult {
  outputPath: string;
  outputFilename: string;
  mimeType: string;
  size: number;
  duration?: number;
}
