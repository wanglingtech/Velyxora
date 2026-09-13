import { BaseMediaProvider } from './MediaProvider';
import { MediaAnalysisResult, MediaPlatform } from '../types/media';
import { validateSafeUrl } from '../security/ssrfValidator';

export class YouTubeProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'youtube';
  readonly name = 'YouTube';
  readonly domainPatterns = [
    /(^|\.)youtube\.com$/i,
    /(^|\.)youtu\.be$/i,
  ];

  extractId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.replace(/^\//, '').split('?')[0];
      }
      return parsed.searchParams.get('v');
    } catch {
      return null;
    }
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    const videoId = this.extractId(url);
    if (!videoId) {
      throw new Error('Could not parse a valid YouTube Video ID from the provided URL.');
    }

    // SSRF verification before calling external oembed
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    const safetyCheck = await validateSafeUrl(oembedUrl);
    if (!safetyCheck.valid) {
      throw new Error(safetyCheck.error || 'Security restriction prevented external fetch');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`YouTube responded with status ${response.status} (${response.statusText}). Video may be private or unavailable.`);
      }

      const data = (await response.json()) as any;

      return {
        url,
        platform: this.platform,
        title: data.title || `YouTube Video (${videoId})`,
        author: data.author_name || 'YouTube Creator',
        authorUrl: data.author_url,
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        embedHtml: `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
        formats: [],
        isDirectDownloadPossible: false,
        requiresExternalExtractor: true,
        notice: 'Direct media stream extraction requires yt-dlp binary with appropriate cookies and user authorization.',
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`Failed to fetch YouTube metadata: ${err.message}`);
    }
  }
}
