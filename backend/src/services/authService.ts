import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../security/password';

export const SESSION_COOKIE = 'velyxora_session';
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
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
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new Error('Credenciales inválidas.');
    if (user.status !== 'ACTIVE') throw new Error('Cuenta suspendida.');
    return this.createSession(user.id);
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + Number(process.env.SESSION_TTL_HOURS || 168) * 3600_000);
    const session = await prisma.session.create({ data: { userId, tokenHash: hashToken(token), csrfHash: hashToken(csrf), expiresAt }, include: { user: true } });
    return { token, csrf, expiresAt, user: session.user };
  }

  async resolve(token?: string) {
    if (!token) return null;
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return null;
    return session;
  }

  verifyCsrf(session: { csrfHash: string }, csrf?: string) { return Boolean(csrf && hashToken(csrf) === session.csrfHash); }
  async logout(token?: string) { if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }); }
}

export const authService = new AuthService();
