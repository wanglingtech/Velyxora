import { Request, Response } from 'express';
import { mediaService } from '../services/mediaService';
import { HTTP_STATUS } from '../config/constants';
import { mediaDownloadService } from '../services/mediaDownloadService';
import { providerPolicyService } from '../services/providerPolicyService';
import { YtDlpError } from '../services/ytDlpService';

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
        code: err instanceof YtDlpError ? err.code : 'ANALYSIS_FAILED',
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function processMedia(req: Request, res: Response): Promise<void> {
  const { url, formatId, container, type, title } = req.body || {};
  if (typeof url !== 'string' || typeof formatId !== 'string' || typeof container !== 'string' || (type !== 'video' && type !== 'audio')) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Se requieren url y formatId válidos.' }, timestamp: new Date().toISOString() });
    return;
  }
  try {
    providerPolicyService.assertAllowed(url);
    const job = await mediaDownloadService.start(url, formatId, container, type, typeof title === 'string' ? title : 'Contenido multimedia', process.env.NODE_ENV === 'test' ? undefined : { userId: req.auth!.userId, isAdmin: req.auth!.role === 'ADMIN' });
    res.status(HTTP_STATUS.ACCEPTED).json({ success: true, data: job, timestamp: new Date().toISOString() });
  } catch (error: any) {
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ success: false, error: { code: 'DOWNLOAD_REJECTED', message: error.message }, timestamp: new Date().toISOString() });
  }
}
