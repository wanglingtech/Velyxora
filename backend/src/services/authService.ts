import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../security/password';
import { logger } from '../utils/logger';

export const SESSION_COOKIE = 'velyxora_session';
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export type SessionResolution =
  | { status: 'AUTHENTICATED'; session: NonNullable<Awaited<ReturnType<AuthService['findSession']>>> }
  | { status: 'MISSING_COOKIE' | 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'USER_INACTIVE'; session: null };
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const identityHash = (email: string) => createHash('sha256').update(normalizeEmail(email)).digest('hex');

export class AuthService {
  async register(email: string, password: string, displayName?: string) {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Email inválido.');
    if (await prisma.deniedIdentity.findUnique({ where: { emailHash: identityHash(normalized) } })) throw new Error('No es posible crear una cuenta con este identificador.');
    const normalizedName = displayName?.trim() || '';
    if (!normalizedName) throw new Error('El nombre es obligatorio.');
    if (normalizedName.length > 80) throw new Error('El nombre no puede superar 80 caracteres.');
    const passwordHash = await hashPassword(password);
    return prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUniqueOrThrow({ where: { code: 'FREE' } });
      const user = await tx.user.create({ data: { email: normalized, passwordHash, displayName: normalizedName } });
      const nextResetAt = new Date(); nextResetAt.setUTCMonth(nextResetAt.getUTCMonth() + 1);
      await tx.userPlan.create({ data: { userId: user.id, planId: plan.id, nextResetAt } });
      await tx.creditLedger.create({ data: { userId: user.id, amount: plan.monthlyCredits, type: 'MONTHLY_GRANT', reason: 'Créditos iniciales del plan FREE', idempotencyKey: `signup:${user.id}` } });
      return user;
    });
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user) {
      logger.warn('AUTH_LOGIN_REJECTED', { reason: 'USER_NOT_FOUND' });
      throw new Error('Credenciales inválidas.');
    }
    const passwordMatches = await verifyPassword(password, user.passwordHash).catch(() => false);
    if (!passwordMatches) {
      logger.warn('AUTH_LOGIN_REJECTED', { reason: 'PASSWORD_MISMATCH', role: user.role, status: user.status });
      throw new Error('Credenciales inválidas.');
    }
    if (user.status !== 'ACTIVE') {
      logger.warn('AUTH_LOGIN_REJECTED', { reason: 'STATUS_NOT_ACTIVE', role: user.role, status: user.status });
      throw new Error('Cuenta suspendida.');
    }
    return this.createSession(user.id);
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + Number(process.env.SESSION_TTL_HOURS || 168) * 3600_000);
    const session = await prisma.session.create({ data: { userId, tokenHash: hashToken(token), csrfHash: hashToken(csrf), csrfToken: csrf, expiresAt }, include: { user: true } });
    return { token, csrf, expiresAt, user: session.user };
  }

  private findSession(token: string) {
    return prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  }

  async resolveDetailed(token?: string): Promise<SessionResolution> {
    if (!token) return { status: 'MISSING_COOKIE', session: null };
    const session = await this.findSession(token);
    if (!session) return { status: 'SESSION_NOT_FOUND', session: null };
    if (session.expiresAt <= new Date()) return { status: 'SESSION_EXPIRED', session: null };
    if (session.user.status !== 'ACTIVE') return { status: 'USER_INACTIVE', session: null };
    return { status: 'AUTHENTICATED', session };
  }

  async resolve(token?: string) {
    const result = await this.resolveDetailed(token);
    return result.session;
  }

  verifyCsrf(session: { csrfHash: string }, csrf?: string) { return Boolean(csrf && hashToken(csrf) === session.csrfHash); }
  async getOrCreateCsrf(sessionId: string, existing?: string | null) {
    if (existing) return existing;
    const csrf = randomBytes(24).toString('base64url');
    const claimed = await prisma.session.updateMany({ where: { id: sessionId, csrfToken: null }, data: { csrfHash: hashToken(csrf), csrfToken: csrf } });
    if (claimed.count === 1) return csrf;
    const session = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, select: { csrfToken: true } });
    if (!session.csrfToken) throw new Error('CSRF_SESSION_UNAVAILABLE');
    return session.csrfToken;
  }
  async logout(token?: string) { if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }); }
}

export const authService = new AuthService();
