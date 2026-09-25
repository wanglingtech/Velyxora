import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/prisma';
import { ENV } from '../config/env';
import { FREE_SERVICE_LIMITS } from '../config/freeServiceLimits';
import { effectiveUploadLimit } from '../middleware/uploadHandler';
const router = Router(); router.use(requireAuth);
router.get('/', async (req, res) => {
  const userId = req.auth!.userId;
  const [user, usages, history, complaints, suggestions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, displayName: true } }),
    prisma.processingUsage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.processingHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.complaint.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.suggestion.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const commercialBypass = req.auth!.role === 'ADMIN';
  const localAdminMode = commercialBypass && ENV.NODE_ENV !== 'production';
  const effectiveMaxUploadSize = effectiveUploadLimit(FREE_SERVICE_LIMITS.maxUploadSizeBytes, commercialBypass, ENV.MAX_UPLOAD_SIZE_BYTES, ENV.NODE_ENV, ENV.LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES);
  res.json({ success: true, data: { email: user.email, displayName: user.displayName, status: 'ACTIVE', capabilities: { effectiveMaxUploadSize, infrastructureMaxUploadSize: localAdminMode ? ENV.LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES : ENV.MAX_UPLOAD_SIZE_BYTES, commercialBypass, localAdminMode, environment: ENV.NODE_ENV }, jobs: usages.map((u) => ({ ...u, inputBytes: u.inputBytes.toString() })), history: history.map((h) => ({ ...h, inputSize: h.inputSize?.toString() ?? null, outputSize: h.outputSize?.toString() ?? null })), complaints, suggestions } });
});
export default router;
