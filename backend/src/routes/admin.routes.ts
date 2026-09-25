import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { creditLedgerService } from "../services/creditLedgerService";
import { paymentService } from "../services/paymentService";
import { randomUUID } from "node:crypto";
import { identityHash } from "../services/authService";
import { adminMutationLimit } from '../security/routeLimits';
import { getAdminServiceStatus, updateServiceStatus } from '../controllers/serviceStatusController';
const router = Router();
router.use(requireAuth, requireRole("ADMIN"));
router.use((req, res, next) => ['POST','PUT','PATCH','DELETE'].includes(req.method) ? adminMutationLimit(req, res, next) : next());
const hasMarkup = (value: string) => /<[^>]*>|javascript:/i.test(value);

router.get("/dashboard", async (_req, res) => {
  const [users, activeUsers, jobs, creditTotals, payments, pendingComplaints, newSuggestions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.processingUsage.count(),
    prisma.creditLedger.aggregate({ _sum: { amount: true } }),
    prisma.paymentOrder.groupBy({ by: ["status"], _count: true }),
    prisma.complaint.count({ where: { status: { in: ["RECEIVED", "IN_REVIEW"] } } }),
    prisma.suggestion.count({ where: { status: "SUBMITTED" } }),
  ]);
  res.json({
    success: true,
    data: {
      users,
      activeUsers,
      jobs,
      netCredits: creditTotals._sum.amount ?? 0,
      payments,
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
      plans: { where: { active: true }, take: 1, include: { plan: true } },
    },
  });
  res.json({
    success: true,
    data: await Promise.all(
      users.map(async (user) => ({
        ...user,
        plan: user.plans[0]?.plan.code ?? "FREE",
        plans: undefined,
        credits: await creditLedgerService.balance(user.id),
      })),
    ),
  });
});
router.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      plans: { where: { active: true }, include: { plan: true } },
      ledger: { orderBy: { createdAt: "desc" }, take: 50 },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
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
      balance: await creditLedgerService.balance(user.id),
      usages: user.usages.map((usage) => ({
        ...usage,
        inputBytes: usage.inputBytes.toString(),
      })),
    },
  });
});
router.post("/users/:id/credits", async (req, res) => {
  const amount = Number(req.body.amount);
  const reason = String(req.body.reason || "").trim();
  const idempotencyKey =
    req.header("idempotency-key") || `admin:${randomUUID()}`;
  if (
    !Number.isInteger(amount) ||
    amount === 0 ||
    reason.length < 3 ||
    idempotencyKey.length > 128
  ) {
    res
      .status(400)
      .json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Cantidad, razón y clave de idempotencia válidas requeridas.",
        },
      });
    return;
  }
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!target) throw new Error("Usuario no encontrado.");
      const existing = await tx.creditLedger.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          reason: true,
          createdAt: true,
        },
      });
      if (existing) {
        if (
          existing.userId !== req.params.id ||
          existing.type !== "ADMIN_ADJUSTMENT"
        )
          throw new Error("Clave de idempotencia ya utilizada.");
        return existing;
      }
      const ledger = await tx.creditLedger.create({
        data: {
          userId: req.params.id,
          amount,
          type: "ADMIN_ADJUSTMENT",
          reason,
          idempotencyKey,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId: req.auth!.userId,
          targetUserId: req.params.id,
          action: "CREDIT_ADJUSTMENT",
          reason,
          metadata: { amount, ledgerId: ledger.id },
        },
      });
      return {
        id: ledger.id,
        userId: ledger.userId,
        amount: ledger.amount,
        type: ledger.type,
        reason: ledger.reason,
        createdAt: ledger.createdAt,
      };
    });
    res.json({ success: true, data: entry });
  } catch (error: any) {
    res
      .status(400)
      .json({
        success: false,
        error: { code: "CREDIT_ADJUSTMENT_FAILED", message: error.message },
      });
  }
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
      if (action === 'ANONYMIZE') { await tx.userPlan.updateMany({ where: { userId: target.id, active: true }, data: { active: false, endsAt: new Date() } }); await tx.user.update({ where: { id: target.id }, data: { status, email: `anonymized-${target.id}@invalid.local`, displayName: null, passwordHash: `disabled$${randomUUID()}` } }); }
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
router.patch("/users/:id/plan", async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  if (
    !["FREE", "PLUS", "PRO"].includes(req.body.planCode) ||
    reason.length < 3
  ) {
    res
      .status(400)
      .json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Plan y razón requeridos.",
        },
      });
    return;
  }
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { code: req.body.planCode },
  });
  await prisma.$transaction(async (tx) => {
    await tx.userPlan.updateMany({
      where: { userId: req.params.id, active: true },
      data: { active: false, endsAt: new Date() },
    });
    await tx.userPlan.create({
      data: { userId: req.params.id, planId: plan.id },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: req.auth!.userId,
        targetUserId: req.params.id,
        action: "PLAN_CHANGE",
        reason,
        metadata: { planCode: req.body.planCode },
      },
    });
  });
  res.json({
    success: true,
    data: { userId: req.params.id, planCode: req.body.planCode },
  });
});
router.post("/payments/:id/review", async (req, res) => {
  try {
    if (!["APPROVE", "REJECT"].includes(req.body.decision))
      throw new Error("Decisión inválida.");
    res.json({
      success: true,
      data: await paymentService.review(
        req.auth!.userId,
        req.params.id,
        req.body.decision === "APPROVE",
        String(req.body.reason || ""),
      ),
    });
  } catch (e: any) {
    res
      .status(400)
      .json({
        success: false,
        error: { code: "REVIEW_FAILED", message: e.message },
      });
  }
});
router.get("/payments", async (_req, res) =>
  res.json({
    success: true,
    data: await prisma.paymentOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { payment: true },
    }),
  }),
);
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
router.get("/plans", async (_req, res) =>
  res.json({
    success: true,
    data: await prisma.plan.findMany({ orderBy: { priority: "asc" } }),
  }),
);
router.patch("/plans/:code", async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  const allowed = [
    "monthlyCredits",
    "maxUploadSize",
    "maxConcurrentJobs",
    "priority",
    "historyRetention",
  ];
  const data: Record<string, number | null> = {};
  for (const key of allowed)
    if (
      req.body[key] === null ||
      (Number.isInteger(req.body[key]) && req.body[key] >= 0)
    )
      data[key] = req.body[key];
  if (
    !["FREE", "PLUS", "PRO"].includes(req.params.code) ||
    reason.length < 3 ||
    !Object.keys(data).length
  ) {
    res
      .status(400)
      .json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Cambios y razón válidos requeridos.",
        },
      });
    return;
  }
  const plan = await prisma.$transaction(async (tx) => {
    const updated = await tx.plan.update({
      where: { code: req.params.code as any },
      data,
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: req.auth!.userId,
        action: "PLAN_CONFIG_CHANGE",
        reason,
        metadata: { code: req.params.code, data },
      },
    });
    return updated;
  });
  res.json({ success: true, data: plan });
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
