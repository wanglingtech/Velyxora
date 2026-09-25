import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { randomUUID } from "node:crypto";
import { identityHash } from "../services/authService";
import { adminMutationLimit } from '../security/routeLimits';
import { getAdminServiceStatus, updateServiceStatus } from '../controllers/serviceStatusController';
const router = Router();
router.use(requireAuth, requireRole("ADMIN"));
router.use((req, res, next) => ['POST','PUT','PATCH','DELETE'].includes(req.method) ? adminMutationLimit(req, res, next) : next());
const hasMarkup = (value: string) => /<[^>]*>|javascript:/i.test(value);

router.get("/dashboard", async (_req, res) => {
  const [users, activeUsers, jobs, pendingComplaints, newSuggestions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.processingUsage.count(),
    prisma.complaint.count({ where: { status: { in: ["RECEIVED", "IN_REVIEW"] } } }),
    prisma.suggestion.count({ where: { status: "SUBMITTED" } }),
  ]);
  res.json({
    success: true,
    data: {
      users,
      activeUsers,
      jobs,
      pendingComplaints,
      newSuggestions,
    },
  });
});
router.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
  });
  res.json({ success: true, data: users });
});
router.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      usages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!user) {
    res
      .status(404)
      .json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "Usuario no encontrado." },
      });
    return;
  }
  res.json({
    success: true,
    data: {
      ...user,
      usages: user.usages.map((usage) => ({
        ...usage,
        inputBytes: usage.inputBytes.toString(),
      })),
    },
  });
});
router.patch("/users/:id/status", async (req, res) => {
  const status = req.body.status;
  const reason = String(req.body.reason || "").trim();
  if (!["ACTIVE", "SUSPENDED"].includes(status) || reason.length < 3) {
    res
      .status(400)
      .json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Estado y razón válidos requeridos.",
        },
      });
    return;
  }
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: req.params.id },
      data: { status },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: req.auth!.userId,
        targetUserId: req.params.id,
        action: `USER_${status}`,
        reason,
      },
    });
    return updated;
  });
  res.json({ success: true, data: { id: user.id, status: user.status } });
});
router.post("/users/:id/moderate", async (req, res) => {
  const action = String(req.body.action || ""); const reason = String(req.body.reason || "").trim();
  if (!['SUSPEND','REACTIVATE','BAN','ANONYMIZE'].includes(action) || reason.length < 5 || reason.length > 500 || hasMarkup(reason)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Acción y motivo obligatorio válidos.' } });
  if (req.params.id === req.auth!.userId && ['BAN','ANONYMIZE'].includes(action)) return res.status(409).json({ success: false, error: { code: 'SELF_MODERATION_FORBIDDEN', message: 'No puedes bloquear o anonimizar tu propia cuenta administrativa.' } });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUniqueOrThrow({ where: { id: req.params.id } });
      if (target.role === 'ADMIN' && ['BAN','ANONYMIZE'].includes(action)) throw new Error('La moderación destructiva de administradores no está permitida desde esta acción.');
      const status = action === 'SUSPEND' ? 'SUSPENDED' : action === 'REACTIVATE' ? 'ACTIVE' : action === 'BAN' ? 'BANNED' : 'ANONYMIZED';
      if (action === 'BAN' || action === 'ANONYMIZE') await tx.deniedIdentity.upsert({ where: { emailHash: identityHash(target.email) }, update: { reason, adminId: req.auth!.userId }, create: { emailHash: identityHash(target.email), reason, adminId: req.auth!.userId } });
      if (action !== 'REACTIVATE') await tx.session.deleteMany({ where: { userId: target.id } });
      if (action === 'ANONYMIZE') { await tx.user.update({ where: { id: target.id }, data: { status, email: `anonymized-${target.id}@invalid.local`, displayName: null, passwordHash: `disabled$${randomUUID()}` } }); }
      else await tx.user.update({ where: { id: target.id }, data: { status } });
      await tx.adminAuditLog.create({ data: { adminId: req.auth!.userId, targetUserId: target.id, action: `USER_${action}`, reason } });
      return { id: target.id, status };
    });
    res.json({ success: true, data: result });
  } catch (error: any) { res.status(400).json({ success: false, error: { code: 'MODERATION_FAILED', message: error.message } }); }
});

router.get('/complaints', async (req, res) => { const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50)); const status = typeof req.query.status === 'string' ? req.query.status : undefined; res.json({ success: true, data: await prisma.complaint.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take }) }); });
router.patch('/complaints/:id', async (req, res) => { const status = String(req.body.status || ''); const response = String(req.body.response || '').trim(); if (!['RECEIVED','IN_REVIEW','RESPONDED','CLOSED'].includes(status) || response.length > 2000 || (status === 'RESPONDED' && response.length < 3)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Estado o respuesta inválidos.' } }); const item = await prisma.complaint.update({ where: { id: req.params.id }, data: { status: status as any, adminResponse: response || undefined, respondedAt: response ? new Date() : undefined } }); await prisma.adminAuditLog.create({ data: { adminId: req.auth!.userId, targetUserId: item.userId, action: 'COMPLAINT_UPDATED', reason: `Estado ${status}`, metadata: { complaintId: item.id } } }); res.json({ success: true, data: item }); });
router.get('/suggestions', async (req, res) => { const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50)); res.json({ success: true, data: await prisma.suggestion.findMany({ orderBy: { createdAt: 'desc' }, take }) }); });
router.patch('/suggestions/:id', async (req, res) => { const status = String(req.body.status || ''); const response = String(req.body.response || '').trim(); const reaction = String(req.body.reaction || ''); if (!['SUBMITTED','REVIEWING','PLANNED','DECLINED','COMPLETED'].includes(status) || response.length > 2000 || !['','👍','❤️','🎉','💡','👀'].includes(reaction)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Estado, respuesta o reacción inválidos.' } }); const item = await prisma.suggestion.update({ where: { id: req.params.id }, data: { status: status as any, adminResponse: response || undefined, reaction: reaction || undefined, respondedAt: response ? new Date() : undefined } }); await prisma.adminAuditLog.create({ data: { adminId: req.auth!.userId, targetUserId: item.userId, action: 'SUGGESTION_UPDATED', reason: `Estado ${status}`, metadata: { suggestionId: item.id } } }); res.json({ success: true, data: item }); });
router.get("/jobs", async (_req, res) => {
  const jobs = await prisma.processingUsage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    success: true,
    data: jobs.map((job) => ({
      ...job,
      inputBytes: job.inputBytes.toString(),
    })),
  });
});
router.get("/audit", async (_req, res) =>
  res.json({
    success: true,
    data: await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  }),
);

router.get('/short-links/reports', async (req, res) => {
  const take = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const reports = await prisma.shortLinkReport.findMany({ orderBy: { createdAt: 'desc' }, take, include: { shortLink: { select: { slug: true, status: true, createdAt: true } } } });
  res.json({ success: true, data: reports });
});

router.patch('/short-links/:slug/moderation', async (req, res) => {
  const action = String(req.body?.action || '');
  const reason = String(req.body?.reason || '').trim();
  if (!['DISABLE','ENABLE'].includes(action) || reason.length < 3 || reason.length > 500) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Acción y razón válidas requeridas.' } }); return; }
  const link = await prisma.shortLink.findUnique({ where: { slug: req.params.slug } });
  if (!link) { res.status(404).json({ success: false, error: { code: 'SHORT_LINK_NOT_FOUND', message: 'Enlace no encontrado.' } }); return; }
  const updated = await prisma.$transaction(async (tx) => {
    const value = await tx.shortLink.update({ where: { id: link.id }, data: action === 'DISABLE' ? { status: 'DISABLED', disabledAt: new Date(), disabledReason: reason } : { status: 'ACTIVE', disabledAt: null, disabledReason: null } });
    await tx.adminAuditLog.create({ data: { adminId: req.auth!.userId, targetUserId: link.userId, action: `SHORT_LINK_${action}D`, reason, metadata: { slug: link.slug } } });
    return value;
  });
  res.json({ success: true, data: { slug: updated.slug, status: updated.status } });
});

router.patch('/short-links/reports/:id', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['REVIEWED','DISMISSED'].includes(status)) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Estado de reporte inválido.' } }); return; }
  const report = await prisma.shortLinkReport.update({ where: { id: req.params.id }, data: { status: status as any, reviewedBy: req.auth!.userId, reviewedAt: new Date() } });
  await prisma.adminAuditLog.create({ data: { adminId: req.auth!.userId, action: 'SHORT_LINK_REPORT_REVIEWED', reason: `Reporte ${status}`, metadata: { reportId: report.id, shortLinkId: report.shortLinkId } } });
  res.json({ success: true, data: report });
});
router.get('/service-status', getAdminServiceStatus);
router.put('/service-status', updateServiceStatus);
export default router;
