import express, { Express } from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import apiRouter from './routes/api.router';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './security/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import cookieParser from 'cookie-parser';

export function createBackendApp(): Express {
  const app = express();

  // Security & Middleware
  app.use(cors({
    origin: ENV.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
  }));

  app.use(rateLimiter);
  app.use(requestLogger);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // API Routes
  app.use('/api', apiRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const backendApp = createBackendApp();
