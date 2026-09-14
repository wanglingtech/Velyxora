import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authService, SESSION_COOKIE } from '../services/authService';
import { logger } from '../utils/logger';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await authService.resolve(req.cookies?.[SESSION_COOKIE]);
  if (!session) {
    logger.warn(`AUTH_SESSION_INVALID endpoint=${req.originalUrl} status=401`);
    res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Inicia sesión.' } }); return;
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !authService.verifyCsrf(session, req.header('x-csrf-token'))) {
    res.status(403).json({ success: false, error: { code: 'CSRF_INVALID', message: 'Token CSRF inválido.' } }); return;
  }
  req.auth = { userId: session.user.id, role: session.user.role, email: session.user.email, sessionId: session.id };
  next();
}

export const requireRole = (role: UserRole) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) { res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Inicia sesión.' } }); return; }
  if (req.auth.role !== role) { res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Acceso denegado.' } }); return; }
  next();
};

// The real engine suites intentionally run without a database. This seam is
// unreachable outside NODE_ENV=test; auth and admin routes always use requireAuth.
export async function requireProcessingAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test') { req.auth = { userId: '00000000-0000-0000-0000-000000000000', role: 'USER', email: 'engine-test@invalid', sessionId: 'engine-test' }; next(); return; }
  return requireAuth(req, res, next);
}
