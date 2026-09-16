import { PrismaClient } from "@prisma/client";
import { PLAN_CONFIG } from "../config/plans";
import { hashPassword, verifyPassword } from "../security/password";
import { normalizeEmail } from "./authService";
import { logger } from "../utils/logger";

type AdminSeedConfig = {
  email: string;
  password: string;
  updateExistingPassword?: boolean;
};

type AdminSeedResult = {
  adminConfigured: boolean;
  adminSeeded: boolean;
  action: "SKIPPED" | "CREATED" | "EXISTING" | "PROMOTED" | "PASSWORD_UPDATED_EXPLICITLY";
  role?: string;
  status?: string;
  passwordMatches?: boolean;
};

export async function seedInitialData(
  prisma: PrismaClient,
  admin?: AdminSeedConfig,
): Promise<AdminSeedResult> {
  for (const [code, config] of Object.entries(PLAN_CONFIG)) {
    await prisma.plan.upsert({
      where: { code: code as any },
      update: config,
      create: { code: code as any, ...config },
    });
  }
  if (!admin?.email || !admin.password) {
    logger.info("ADMIN_SEED_RESULT", { adminConfigured: false, action: "SKIPPED" });
    return { adminConfigured: false, adminSeeded: false, action: "SKIPPED" };
  }
  const email = normalizeEmail(admin.email);
  let user = await prisma.user.findUnique({ where: { email } });
  let action: AdminSeedResult["action"] = "EXISTING";
  if (!user) {
    const passwordHash = await hashPassword(admin.password);
    user = await prisma.user.create({ data: { email, passwordHash, role: "ADMIN" } });
    action = "CREATED";
  } else if (user.role !== "ADMIN") {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    action = "PROMOTED";
  }

  let passwordMatches = await verifyPassword(admin.password, user.passwordHash).catch(() => false);
  if (!passwordMatches && admin.updateExistingPassword) {
    const passwordHash = await hashPassword(admin.password);
    user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    passwordMatches = true;
    action = "PASSWORD_UPDATED_EXPLICITLY";
  }
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId: user.id, active: true },
  });
  if (!activePlan)
    await prisma.userPlan.create({
      data: { userId: user.id, planId: plan.id },
    });
  const result = {
    adminConfigured: true,
    adminSeeded: true,
    action,
    role: user.role,
    status: user.status,
    passwordMatches,
  } satisfies AdminSeedResult;
  logger.info("ADMIN_SEED_RESULT", result);
  return result;
}
