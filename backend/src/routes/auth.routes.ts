import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authService, SESSION_COOKIE } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

const router = Router();
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
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
const setSessionCookies = (res: any, session: { token: string; csrf: string; expiresAt: Date }) => {
  res.cookie(SESSION_COOKIE, session.token, { ...cookieOptions, expires: session.expiresAt });
};
const publicUser = (user: { id: string; email: string; displayName: string | null; role: string; status: string }) => ({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status });

router.post('/register', async (req, res) => {
  try {
    const user = await authService.register(String(req.body.email || ''), String(req.body.password || ''), req.body.displayName);
    const session = await authService.createSession(user.id);
    setSessionCookies(res, session);
    logger.info(`AUTH_REGISTER_SUCCESS userId=${user.id} endpoint=${req.originalUrl} status=201`);
    res.status(201).json({ success: true, data: { user: publicUser(user), csrf: session.csrf } });
  } catch (error: any) { res.status(400).json({ success: false, error: { code: 'REGISTER_FAILED', message: error.code === 'P2002' ? 'El email ya está registrado.' : error.message } }); }
});

router.post('/login', authLimit, async (req, res) => {
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
  const csrf = await authService.rotateCsrf(req.auth!.sessionId);
  res.json({ success: true, data: { authenticated: true, user, csrf } });
});

router.post('/logout', requireAuth, async (req, res) => {
  await prisma.session.delete({ where: { id: req.auth!.sessionId } });
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  logger.info(`AUTH_LOGOUT userId=${req.auth!.userId} endpoint=${req.originalUrl} status=200`);
  res.json({ success: true });
});

export default router;
