import { Router } from 'express';
import type { CookieOptions, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authService, SESSION_COOKIE } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { ENV } from '../config/env';

const router = Router();
const requireJsonAndTrustedOrigin = (req: any, res: any, next: any) => {
  if (!req.is('application/json')) { res.status(415).json({ success: false, error: { code: 'CONTENT_TYPE_REQUIRED', message: 'La solicitud debe enviarse como JSON.' } }); return; }
  const origin = String(req.header('origin') || '').replace(/\/$/, '');
  if (ENV.NODE_ENV === 'production' && (!origin || !ENV.CORS_ORIGINS.includes(origin))) { res.status(403).json({ success: false, error: { code: 'ORIGIN_FORBIDDEN', message: 'Origen de solicitud no permitido.' } }); return; }
  next();
};
const loginWindowMs = process.env.NODE_ENV === 'production' ? 15 * 60_000 : 60_000;
const authLimit = rateLimit({
  windowMs: loginWindowMs,
  limit: process.env.NODE_ENV === 'production' ? 7 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    const retryAfter = Math.max(1, Math.ceil(Number(res.getHeader('Retry-After') || loginWindowMs / 1000)));
    logger.warn(`AUTH_RATE_LIMITED endpoint=${req.originalUrl} status=429`);
    res.status(429).json({ success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Has realizado demasiados intentos de inicio de sesión. Inténtalo nuevamente en unos minutos.', retryAfter } });
  },
});
const registerLimit = rateLimit({
  windowMs: loginWindowMs,
  limit: process.env.NODE_ENV === 'production' ? 5 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.max(1, Math.ceil(Number(res.getHeader('Retry-After') || loginWindowMs / 1000)));
    logger.warn(`AUTH_RATE_LIMITED endpoint=${req.originalUrl.split('?')[0]} status=429`);
    res.status(429).json({ success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Has realizado demasiadas solicitudes. Espera un momento e inténtalo nuevamente.', retryAfter } });
  },
});
export const buildSessionCookieOptions = (
  nodeEnv: string,
  sameSite: CookieOptions['sameSite'],
): CookieOptions => ({
  httpOnly: true,
  secure: nodeEnv === 'production',
  sameSite,
  path: '/',
});
export const sessionCookieOptions = buildSessionCookieOptions(ENV.NODE_ENV, ENV.SESSION_COOKIE_SAME_SITE);
const setSessionCookies = (res: Response, session: { token: string; csrf: string; expiresAt: Date }) => {
  res.cookie(SESSION_COOKIE, session.token, { ...sessionCookieOptions, expires: session.expiresAt });
};
const publicUser = (user: { id: string; email: string; displayName: string | null; role: string; status: string }) => ({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status });

router.post('/register', registerLimit, requireJsonAndTrustedOrigin, async (req, res) => {
  try {
    const user = await authService.register(String(req.body.email || ''), String(req.body.password || ''), req.body.displayName);
    const session = await authService.createSession(user.id);
    setSessionCookies(res, session);
    logger.info(`AUTH_REGISTER_SUCCESS userId=${user.id} endpoint=${req.originalUrl} status=201`);
    res.status(201).json({ success: true, data: { user: publicUser(user), csrf: session.csrf } });
  } catch (error: any) { res.status(400).json({ success: false, error: { code: 'REGISTER_FAILED', message: error.code === 'P2002' ? 'El email ya está registrado.' : error.message } }); }
});

router.post('/login', authLimit, requireJsonAndTrustedOrigin, async (req, res) => {
  try {
    const session = await authService.login(String(req.body.email || ''), String(req.body.password || ''));
    setSessionCookies(res, session);
    logger.info(`AUTH_LOGIN_SUCCESS userId=${session.user.id} endpoint=${req.originalUrl} status=200`);
    res.json({ success: true, data: { user: publicUser(session.user), csrf: session.csrf } });
  } catch {
    logger.warn(`AUTH_LOGIN_FAILED endpoint=${req.originalUrl} status=401`);
    res.status(401).json({ success: false, error: { code: 'LOGIN_FAILED', message: 'Correo o contraseña incorrectos.' } });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: { id: true, email: true, displayName: true, role: true, status: true } });
  const session = await authService.resolve(req.cookies?.[SESSION_COOKIE]);
  const csrf = await authService.getOrCreateCsrf(req.auth!.sessionId, session?.csrfToken);
  res.json({ success: true, data: { authenticated: true, user, csrf } });
});

router.post('/logout', requireAuth, async (req, res) => {
  await prisma.session.delete({ where: { id: req.auth!.sessionId } });
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  logger.info(`AUTH_LOGOUT userId=${req.auth!.userId} endpoint=${req.originalUrl} status=200`);
  res.json({ success: true });
});

export default router;
