import { MediaAnalysisResult } from '../types/media';
import { validateSafeUrl } from '../security/ssrfValidator';
import { providerRegistry } from '../providers/ProviderRegistry';
import { providerPolicyService } from './providerPolicyService';
import { logger } from '../utils/logger';

class MediaService {
  async analyzeUrl(rawUrl: string): Promise<MediaAnalysisResult> {
    // 1. SSRF and protocol security checks (run before any network access)
    const safety = await validateSafeUrl(rawUrl);
    if (!safety.valid) {
      throw new Error(safety.error || 'URL failed security validation');
    }

    // 2. Known social providers use yt-dlp; any other host is treated as a
    // direct media link (image/video/audio) instead of being rejected.
    const providerName = providerPolicyService.resolve(rawUrl);
    const provider = providerName ? providerRegistry.find(rawUrl) : providerRegistry.direct;
    if (provider === providerRegistry.generic) throw new Error('Este proveedor no está admitido actualmente.');
    logger.info('MEDIA_PROVIDER', { provider: providerName || 'direct', stage: 'analyze' });
    return provider.analyze(rawUrl);
  }
}

export const mediaService = new MediaService();
