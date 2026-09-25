import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { creditLedgerService } from '../services/creditLedgerService';
import { ENV } from '../config/env';
import { FREE_SERVICE_LIMITS } from '../config/freeServiceLimits';
import { effectiveUploadLimit } from '../middleware/uploadHandler';
const router = Router(); router.use(requireAuth);
router.get('/', async (req, res) => {
  const userId = req.auth!.userId;
  const [user, balance, ledger, usages, history, payments, complaints, suggestions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, displayName: true, plans: { where: { active: true }, take: 1, include: { plan: true } } } }),
    creditLedgerService.balance(userId),
    prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { amount: true, type: true, reason: true, toolId: true, createdAt: true } }),
    prisma.processingUsage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.processingHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.paymentOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, credits: true, amountMinor: true, currency: true, reference: true, createdAt: true, updatedAt: true, plan: { select: { code: true } } } }),
    prisma.complaint.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.suggestion.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const plan = user.plans[0]?.plan ?? null;
  const commercialBypass = req.auth!.role === 'ADMIN';
  const localAdminMode = commercialBypass && ENV.NODE_ENV !== 'production';
  const effectiveMaxUploadSize = effectiveUploadLimit(FREE_SERVICE_LIMITS.maxUploadSizeBytes, commercialBypass, ENV.MAX_UPLOAD_SIZE_BYTES, ENV.NODE_ENV, ENV.LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES);
  res.json({ success: true, data: { email: user.email, displayName: user.displayName, status: 'ACTIVE', plan, capabilities: { effectiveMaxUploadSize, infrastructureMaxUploadSize: localAdminMode ? ENV.LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES : ENV.MAX_UPLOAD_SIZE_BYTES, commercialBypass, localAdminMode, environment: ENV.NODE_ENV }, nextResetAt: user.plans[0]?.nextResetAt ?? null, credits: balance, ledger, jobs: usages.map((u) => ({ ...u, inputBytes: u.inputBytes.toString() })), history: history.map((h) => ({ ...h, inputSize: h.inputSize?.toString() ?? null, outputSize: h.outputSize?.toString() ?? null })), payments, complaints, suggestions } });
});
export default router;
