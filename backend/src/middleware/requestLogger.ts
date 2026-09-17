import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP_REQUEST', { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, durationMs: duration });
  });
  next();
}
