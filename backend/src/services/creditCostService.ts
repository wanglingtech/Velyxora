export type ProcessingClass = 'LOCAL' | 'SERVER' | 'EXTERNAL';

const SERVER_TOOLS = new Set([
  'video-to-mp3','video-compressor','video-to-wav','video-to-gif','video-trimmer','video-mute','video-speed','video-resize','mp4-to-webm','webm-to-mp4',
  'wav-to-mp3','mp3-to-wav','audio-bitrate','audio-normalize','word-to-pdf','xlsx-to-pdf','pptx-to-pdf','odt-to-pdf','ods-to-pdf','odp-to-pdf',
]);

export class CreditCostService {
  classify(toolId: string): ProcessingClass { return toolId === 'media-url-analyzer' ? 'EXTERNAL' : SERVER_TOOLS.has(toolId) ? 'SERVER' : 'LOCAL'; }
  estimate(toolId: string, inputBytes = 0, options: Record<string, unknown> = {}) {
    const processingClass = this.classify(toolId);
    if (processingClass === 'LOCAL') return { processingClass, baseCost: 0, sizeTier: 0, estimatedCredits: 0 };
    const baseCost = processingClass === 'EXTERNAL' ? 3 : 2;
    const sizeTier = Math.max(0, Math.ceil(inputBytes / (25 * 1024 * 1024)) - 1);
    const parameterCost = options.highQuality === true ? 1 : 0;
    return { processingClass, baseCost, sizeTier, estimatedCredits: baseCost + sizeTier + parameterCost };
  }
}
export const creditCostService = new CreditCostService();
