import { MediaAnalysisResult } from '../types/media';
import { validateSafeUrl } from '../security/ssrfValidator';
import { providerRegistry } from '../providers/ProviderRegistry';
import { providerPolicyService } from './providerPolicyService';

class MediaService {
  async analyzeUrl(rawUrl: string): Promise<MediaAnalysisResult> {
    providerPolicyService.assertAllowed(rawUrl);
    // 1. SSRF and protocol security checks
    const safety = await validateSafeUrl(rawUrl);
    if (!safety.valid) {
      throw new Error(safety.error || 'URL failed security validation');
    }

    // 2. Locate matching provider
    const provider = providerRegistry.find(rawUrl);
    if (provider === providerRegistry.generic) throw new Error('Este proveedor no está admitido actualmente.');
    return provider.analyze(rawUrl);
  }
}

export const mediaService = new MediaService();
