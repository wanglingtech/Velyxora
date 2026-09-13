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

  return {
    valid: true,
    data: {
      fileId: body.fileId,
      sourceFilePath: body.sourceFilePath,
      toolId: body.toolId.trim(),
      targetFormat: body.targetFormat.trim().toLowerCase(),
      options: body.options || {},
    },
  };
}
