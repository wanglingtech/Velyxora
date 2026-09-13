export interface ConversionRequestDto {
  fileId?: string;
  sourceFilePath?: string;
  toolId: string;
  targetFormat: string;
  options?: {
    quality?: number;
    resolution?: string;
    bitrate?: string;
    sampleRate?: number;
    fps?: number;
    trimStart?: number;
    trimEnd?: number;
    muteAudio?: boolean;
    watermarkText?: string;
    speedMultiplier?: number;
    normalizeAudio?: boolean;
    gifWidth?: number;
  };
}

export interface MediaAnalyzeRequestDto {
  url: string;
}

export function validateConversionDto(body: any): { valid: boolean; error?: string; data?: ConversionRequestDto } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  if (!body.toolId || typeof body.toolId !== 'string') {
    return { valid: false, error: 'Missing or invalid required field: toolId' };
  }

  if (!body.targetFormat || typeof body.targetFormat !== 'string') {
    return { valid: false, error: 'Missing or invalid required field: targetFormat' };
  }
  if (!['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'mp4', 'webm', 'mov', 'mkv', 'gif', 'png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(body.targetFormat.toLowerCase())) return { valid: false, error: 'Unsupported target format' };

  if (!body.fileId || typeof body.fileId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(body.fileId)) {
    return { valid: false, error: 'Missing or invalid required field: fileId' };
  }

  const options = body.options || {};
  const allowedKeys = new Set(['quality', 'resolution', 'bitrate', 'sampleRate', 'fps', 'trimStart', 'trimEnd', 'muteAudio', 'speedMultiplier', 'normalizeAudio', 'gifWidth']);
  if (Object.keys(options).some((key) => !allowedKeys.has(key))) return { valid: false, error: 'Unsupported conversion option' };
  if (options.speedMultiplier !== undefined && (!Number.isFinite(options.speedMultiplier) || options.speedMultiplier < 0.25 || options.speedMultiplier > 4)) return { valid: false, error: 'speedMultiplier must be between 0.25 and 4' };
  if (options.fps !== undefined && (!Number.isInteger(options.fps) || options.fps < 5 || options.fps > 30)) return { valid: false, error: 'fps must be an integer between 5 and 30' };
  if (options.gifWidth !== undefined && (!Number.isInteger(options.gifWidth) || options.gifWidth < 160 || options.gifWidth > 1280)) return { valid: false, error: 'gifWidth must be between 160 and 1280' };
  if (options.bitrate !== undefined && !['96k', '128k', '192k', '256k', '320k'].includes(options.bitrate)) return { valid: false, error: 'Unsupported audio bitrate' };
  if (options.quality !== undefined && (!Number.isFinite(options.quality) || options.quality < 1 || options.quality > 100)) return { valid: false, error: 'quality must be between 1 and 100' };
  if (options.resolution !== undefined && !['854x480', '1280x720', '1920x1080'].includes(options.resolution)) return { valid: false, error: 'Unsupported video resolution' };
  if (options.trimStart !== undefined && (!Number.isFinite(options.trimStart) || options.trimStart < 0)) return { valid: false, error: 'trimStart must be zero or greater' };
  if (options.trimEnd !== undefined && (!Number.isFinite(options.trimEnd) || options.trimEnd <= (options.trimStart || 0))) return { valid: false, error: 'trimEnd must be greater than trimStart' };
  if (options.muteAudio !== undefined && typeof options.muteAudio !== 'boolean') return { valid: false, error: 'muteAudio must be boolean' };
  if (options.normalizeAudio !== undefined && typeof options.normalizeAudio !== 'boolean') return { valid: false, error: 'normalizeAudio must be boolean' };

  return {
    valid: true,
    data: {
      fileId: body.fileId,
      toolId: body.toolId.trim(),
      targetFormat: body.targetFormat.trim().toLowerCase(),
      options,
    },
  };
}
