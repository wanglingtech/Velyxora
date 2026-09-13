import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { logger } from '../utils/logger';

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

  logger.error(`Unhandled error on ${req.method} ${req.url}:`, {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'An unexpected internal error occurred',
      details: (err as AppError).details,
    },
    timestamp: new Date().toISOString(),
  });
}
