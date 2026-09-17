import express, { Express } from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import apiRouter from './routes/api.router';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './security/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import cookieParser from 'cookie-parser';
import shortRedirectRoutes from './routes/shortRedirect.routes';

export function createBackendApp(): Express {
  const app = express();

  app.set('trust proxy', ENV.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('X-Frame-Options', 'DENY');
    if (ENV.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (/^\/api\/(auth|account|admin|payments|credits|history|jobs|download|conversions|media)(\/|$)/.test(req.path)) res.setHeader('Cache-Control', 'no-store, private');
    next();
  });

  // Security & Middleware
  app.use(cors({
    origin(origin, callback) {
      if (!origin || ENV.CORS_ORIGINS.includes(origin.replace(/\/$/, ""))) return callback(null, true);
      callback(new Error("Origen no permitido por CORS."));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
  }));

  app.use(rateLimiter);
  app.use(requestLogger);

  app.use(express.json({ limit: '1mb', type: 'application/json' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  // API Routes
  app.use('/api', apiRouter);
  app.use('/s', shortRedirectRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const backendApp = createBackendApp();
