import { IMediaProvider } from '../providers/MediaProvider';
import { YouTubeProvider } from '../providers/YouTubeProvider';
import { VimeoProvider } from '../providers/VimeoProvider';
import { TikTokProvider } from '../providers/TikTokProvider';
import {
  FacebookProvider,
  InstagramProvider,
  PinterestProvider,
  RedditProvider,
  TwitterXProvider,
} from '../providers/OtherProviders';
import { MediaAnalysisResult } from '../types/media';
import { validateSafeUrl } from '../security/ssrfValidator';

class MediaService {
  private providers: IMediaProvider[] = [
    new YouTubeProvider(),
    new VimeoProvider(),
    new TikTokProvider(),
    new RedditProvider(),
    new TwitterXProvider(),
    new FacebookProvider(),
    new InstagramProvider(),
    new PinterestProvider(),
  ];

  async analyzeUrl(rawUrl: string): Promise<MediaAnalysisResult> {
    // 1. SSRF and protocol security checks
    const safety = await validateSafeUrl(rawUrl);
    if (!safety.valid) {
      throw new Error(safety.error || 'URL failed security validation');
    }

    // 2. Locate matching provider
    const provider = this.providers.find((p) => p.canHandle(rawUrl));
    if (!provider) {
      throw new Error('No compatible media provider found for the given domain.');
    }

    // 3. Delegate to provider
    return provider.analyze(rawUrl);
  }
}

export const mediaService = new MediaService();
