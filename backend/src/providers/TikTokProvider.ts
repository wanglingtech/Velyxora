import { BaseMediaProvider } from './MediaProvider';
import { MediaAnalysisResult, MediaPlatform } from '../types/media';

export class TikTokProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'tiktok';
  readonly name = 'TikTok';
  readonly domainPatterns = [/(^|\.)tiktok\.com$/i];

  extractId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/video\/(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`TikTok oEmbed returned status ${response.status}`);
      }

      const data = (await response.json()) as any;

      return {
        url,
        platform: this.platform,
        title: data.title || 'TikTok Video',
        author: data.author_name || 'TikTok User',
        authorUrl: data.author_url,
        thumbnailUrl: data.thumbnail_url,
        embedHtml: data.html,
        formats: [],
        isDirectDownloadPossible: false,
        requiresExternalExtractor: true,
        notice: 'TikTok official oEmbed loaded. Direct media downloads require external stream extractor.',
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`Failed to fetch TikTok metadata: ${err.message}`);
    }
  }
}
