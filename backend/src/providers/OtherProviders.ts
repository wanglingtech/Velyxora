import { BaseMediaProvider } from './MediaProvider';
import { MediaAnalysisResult, MediaPlatform } from '../types/media';

export class RedditProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'reddit';
  readonly name = 'Reddit';
  readonly domainPatterns = [/(^|\.)reddit\.com$/i, /(^|\.)redd\.it$/i];

  extractId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/comments\/([a-z0-9]+)/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Reddit oEmbed error: ${response.status}`);
      const data = (await response.json()) as any;

      return {
        url,
        platform: this.platform,
        title: data.title || 'Reddit Post',
        author: data.author_name || 'u/redditor',
        authorUrl: data.author_url,
        embedHtml: data.html,
        formats: [],
        isDirectDownloadPossible: false,
        requiresExternalExtractor: true,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`Failed to analyze Reddit URL: ${err.message}`);
    }
  }
}

export class TwitterXProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'twitter';
  readonly name = 'Twitter / X';
  readonly domainPatterns = [/(^|\.)twitter\.com$/i, /(^|\.)x\.com$/i];

  extractId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/status\/(\d+)/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(oembedUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Twitter oEmbed returned ${response.status}`);
      const data = (await response.json()) as any;

      return {
        url,
        platform: this.platform,
        title: `Tweet by ${data.author_name || 'X user'}`,
        author: data.author_name || 'X User',
        authorUrl: data.author_url,
        embedHtml: data.html,
        formats: [],
        isDirectDownloadPossible: false,
        requiresExternalExtractor: true,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      throw new Error(`Failed to fetch Twitter/X post info: ${err.message}`);
    }
  }
}

export class FacebookProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'facebook';
  readonly name = 'Facebook';
  readonly domainPatterns = [/(^|\.)facebook\.com$/i, /(^|\.)fb\.watch$/i];

  extractId(url: string): string | null {
    return 'fb-video';
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    return {
      url,
      platform: this.platform,
      title: 'Facebook Media Post',
      author: 'Facebook Creator',
      embedHtml: `<p>Facebook media embed preview</p>`,
      formats: [],
      isDirectDownloadPossible: false,
      requiresExternalExtractor: true,
      notice: 'Facebook restricts direct public API scraping without Graph API tokens.',
    };
  }
}

export class InstagramProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'instagram';
  readonly name = 'Instagram';
  readonly domainPatterns = [/(^|\.)instagram\.com$/i];

  extractId(url: string): string | null {
    try {
      const match = url.match(/\/(p|reel|tv)\/([^/?#&]+)/);
      return match ? match[2] : null;
    } catch {
      return null;
    }
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    return {
      url,
      platform: this.platform,
      title: 'Instagram Post / Reel',
      author: 'Instagram User',
      formats: [],
      isDirectDownloadPossible: false,
      requiresExternalExtractor: true,
      notice: 'Instagram strictly restricts automated stream scraping without Graph API credentials.',
    };
  }
}

export class PinterestProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = 'pinterest';
  readonly name = 'Pinterest';
  readonly domainPatterns = [/(^|\.)pinterest\.com$/i, /(^|\.)pin\.it$/i];

  extractId(url: string): string | null {
    return 'pin';
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    return {
      url,
      platform: this.platform,
      title: 'Pinterest Pin',
      author: 'Pinterest User',
      formats: [],
      isDirectDownloadPossible: false,
      requiresExternalExtractor: true,
    };
  }
}
