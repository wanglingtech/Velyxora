import { MediaAnalysisResult } from '../types/media';
import { validateSafeUrl } from '../security/ssrfValidator';
import { providerRegistry } from '../providers/ProviderRegistry';

class MediaService {
  async analyzeUrl(rawUrl: string): Promise<MediaAnalysisResult> {
    // 1. SSRF and protocol security checks
    const safety = await validateSafeUrl(rawUrl);
    if (!safety.valid) {
      throw new Error(safety.error || 'URL failed security validation');
    }

    // 2. Locate matching provider
    return providerRegistry.find(rawUrl).analyze(rawUrl);
  }
}

export const mediaService = new MediaService();
