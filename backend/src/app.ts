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
    const isApi = /^\/(api|s)(\/|$)/.test(req.path);
    if (isApi) {
      // Respuestas de API/redirect: JSON puro, bloquear todo
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    } else if (ENV.NODE_ENV === 'production') {
      // Páginas: CSP de la app (idéntico al de frontend/vercel.json)
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; frame-src https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    }
    // En desarrollo: sin CSP para páginas (Vite necesita inline scripts + HMR)
    res.setHeader('X-Frame-Options', 'DENY');
    if (ENV.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (/^\/api\/(auth|account|admin|history|jobs|download|conversions|media)(\/|$)/.test(req.path)) res.setHeader('Cache-Control', 'no-store, private');
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

  // Rate limiting protects API and redirect endpoints. Pages and static assets
  // must not consume the API budget: a single dev page load requests dozens of
  // Vite modules and would exhaust the window almost immediately.
  app.use((req, res, next) => {
    if (/^\/(api|s)(\/|$)/.test(req.path)) return rateLimiter(req, res, next);
    next();
  });
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
