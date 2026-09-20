import { MediaAnalysisResult, MediaPlatform } from '../types/media';

export interface IMediaProvider {
  readonly platform: MediaPlatform;
  readonly name: string;
  readonly domainPatterns: RegExp[];

  canHandle(url: string): boolean;
  extractId(url: string): string | null;
  analyze(url: string): Promise<MediaAnalysisResult>;
  assertFormatAvailable?(url: string, formatId: string): Promise<void>;
  download?(
    url: string,
    formatId: string,
    container: string,
    type: "video" | "audio",
    outputStem: string,
    signal?: AbortSignal,
    onProgress?: (value: number) => void,
  ): Promise<string>;
}

export abstract class BaseMediaProvider implements IMediaProvider {
  abstract readonly platform: MediaPlatform;
  abstract readonly name: string;
  abstract readonly domainPatterns: RegExp[];

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      return this.domainPatterns.some((pattern) => pattern.test(parsed.hostname));
    } catch {
      return false;
    }
  }

  abstract extractId(url: string): string | null;
  abstract analyze(url: string): Promise<MediaAnalysisResult>;
}
