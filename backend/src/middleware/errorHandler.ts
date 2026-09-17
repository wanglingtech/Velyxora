import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';
import multer from 'multer';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = (err as AppError).statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const code = (err as AppError).code || 'INTERNAL_SERVER_ERROR';

  const uploadError = err instanceof multer.MulterError || req.path.startsWith('/api/uploads');
  const safeStatus = uploadError ? (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 415) : statusCode;
  const safeCode = uploadError ? (safeStatus === 413 ? 'FILE_TOO_LARGE' : 'INVALID_FORMAT') : code;
  logger.error('HTTP_ERROR', {
    method: req.method, path: req.path, code: safeCode,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  const isOperational = err instanceof AppError;
  res.status(safeStatus).json({
    success: false,
    error: {
      code: safeCode,
      message: uploadError ? (safeStatus === 413 ? 'El archivo supera el tamaño permitido para tu plan.' : 'Este formato no es compatible con esta herramienta.') : isOperational ? err.message : 'Ocurrió un problema temporal. Inténtalo nuevamente.',
      ...(isOperational && process.env.NODE_ENV !== 'production' && (err as AppError).details ? { details: (err as AppError).details } : {}),
    },
    timestamp: new Date().toISOString(),
  });
}
