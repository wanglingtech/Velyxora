import { BaseMediaProvider } from './MediaProvider';
import { MediaAnalysisResult, MediaPlatform } from '../types/media';

export class VimeoProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'vimeo';
  readonly name = 'Vimeo';
  readonly domainPatterns = [/(^|\.)vimeo\.com$/i];

  extractId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    const videoId = this.extractId(url);
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Vimeo responded with status ${response.status}`);
      }

      const data = (await response.json()) as any;

      return {
        url,
        platform: this.platform,
        title: data.title || `Vimeo Video ${videoId || ''}`,
        author: data.author_name || 'Vimeo Creator',
        authorUrl: data.author_url,
        thumbnailUrl: data.thumbnail_url,
        durationSeconds: data.duration,
        embedHtml: data.html,
        formats: [],
        isDirectDownloadPossible: false,
        requiresExternalExtractor: true,
        notice: 'Official oEmbed metadata loaded. High-resolution stream downloading requires direct creator permission or yt-dlp.',
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`Failed to fetch Vimeo metadata: ${err.message}`);
    }
  }
}
