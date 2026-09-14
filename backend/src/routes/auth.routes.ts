import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authService, SESSION_COOKIE } from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
const setSessionCookies = (res: any, session: { token: string; csrf: string; expiresAt: Date }) => {
  res.cookie(SESSION_COOKIE, session.token, { ...cookieOptions, expires: session.expiresAt });
  res.cookie('velyxora_csrf', session.csrf, { ...cookieOptions, httpOnly: false, expires: session.expiresAt });
};
const publicUser = (user: { id: string; email: string; displayName: string | null; role: string; status: string }) => ({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status });

router.post('/register', authLimit, async (req, res) => {
  try {
    const user = await authService.register(String(req.body.email || ''), String(req.body.password || ''), req.body.displayName);
    const session = await authService.createSession(user.id);
    setSessionCookies(res, session);
    res.status(201).json({ success: true, data: { user: publicUser(user), csrfToken: session.csrf } });
  } catch (error: any) { res.status(400).json({ success: false, error: { code: 'REGISTER_FAILED', message: error.code === 'P2002' ? 'El email ya está registrado.' : error.message } }); }
});

router.post('/login', authLimit, async (req, res) => {
  try {
    const session = await authService.login(String(req.body.email || ''), String(req.body.password || ''));
    setSessionCookies(res, session);
    res.json({ success: true, data: { user: publicUser(session.user), csrfToken: session.csrf } });
  } catch { res.status(401).json({ success: false, error: { code: 'LOGIN_FAILED', message: 'Credenciales inválidas o cuenta no disponible.' } }); }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: { id: true, email: true, displayName: true, role: true, status: true } });
  res.json({ success: true, data: user });
});

router.post('/logout', requireAuth, async (req, res) => {
  await prisma.session.delete({ where: { id: req.auth!.sessionId } });
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.clearCookie('velyxora_csrf', { ...cookieOptions, httpOnly: false });
  res.json({ success: true });
});

export default router;
