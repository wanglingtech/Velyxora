import { Request, Response } from 'express';
import { mediaService } from '../services/mediaService';
import { HTTP_STATUS } from '../config/constants';

export async function analyzeMedia(req: Request, res: Response): Promise<void> {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'URL_REQUIRED',
        message: 'A valid "url" string is required in the JSON payload.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
  } catch {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: { code: 'INVALID_URL', message: 'La URL debe ser una dirección HTTP o HTTPS válida.' },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const analysis = await mediaService.analyzeUrl(url);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function processMedia(req: Request, res: Response): Promise<void> {
  res.status(HTTP_STATUS.NOT_IMPLEMENTED).json({
    success: false,
    error: {
      code: 'EXTERNAL_EXTRACTOR_REQUIRED',
      message: 'Direct automated downloading of external video streams requires an external stream extractor (yt-dlp) and authorized user credentials.',
    },
    timestamp: new Date().toISOString(),
  });
}
