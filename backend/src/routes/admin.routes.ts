import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../db/prisma";
import { creditLedgerService } from "../services/creditLedgerService";
import { paymentService } from "../services/paymentService";
import { randomUUID } from "node:crypto";
const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get("/dashboard", async (_req, res) => {
  const [users, activeUsers, jobs, creditTotals, payments] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.processingUsage.count(),
    prisma.creditLedger.aggregate({ _sum: { amount: true } }),
    prisma.paymentOrder.groupBy({ by: ["status"], _count: true }),
  ]);
  res.json({
    success: true,
    data: {
      users,
      activeUsers,
      jobs,
      netCredits: creditTotals._sum.amount ?? 0,
      payments,
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
export default router;
