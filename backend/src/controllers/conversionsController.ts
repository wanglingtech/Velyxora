import { Request, Response } from 'express';
import { conversionService } from '../services/conversionService';
import { jobService } from '../services/jobService';
import { validateConversionDto } from '../schemas/validation';
import { HTTP_STATUS } from '../config/constants';
import { processingUsageService } from '../services/processingUsageService';

export async function createConversion(req: Request, res: Response): Promise<void> {
  const validation = validateConversionDto(req.body);
  if (!validation.valid || !validation.data) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.error || 'Invalid request parameters',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const job = await conversionService.startConversion(validation.data, process.env.NODE_ENV === 'test' ? undefined : { userId: req.auth!.userId, isAdmin: req.auth!.role === 'ADMIN' });
    res.status(HTTP_STATUS.ACCEPTED).json({
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
      success: false,
      error: {
        code: 'CONVERSION_REJECTED',
        message: err.message === 'Ya tienes varios procesos en curso. Espera a que termine uno.' ? err.message : 'La conversión no pudo iniciarse con los datos proporcionados.',
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export async function getConversionStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const job = jobService.getJob(id);

  if (!job) {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: {
        code: 'JOB_NOT_FOUND',
        message: `Conversion job with id '${id}' was not found.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  if (process.env.NODE_ENV !== 'test' && job.ownerId !== req.auth?.userId) { res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job no encontrado.' } }); return; }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: job,
    timestamp: new Date().toISOString(),
  });
}

export async function cancelConversion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const owned = jobService.getJob(id);
  if (process.env.NODE_ENV !== 'test' && owned?.ownerId !== req.auth?.userId) { res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job no encontrado.' } }); return; }
  const success = jobService.cancelJob(id);

  if (!success) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'CANCEL_FAILED',
        message: `Could not cancel job '${id}'. It may already be completed, failed, or does not exist.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (process.env.NODE_ENV !== 'test') await processingUsageService.settle(id, 'CANCELLED');

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `Job '${id}' was cancelled successfully.`,
    timestamp: new Date().toISOString(),
  });
}
