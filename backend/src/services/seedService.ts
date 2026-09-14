import { PrismaClient } from "@prisma/client";
import { PLAN_CONFIG } from "../config/plans";
import { hashPassword } from "../security/password";
import { normalizeEmail } from "./authService";

export async function seedInitialData(
  prisma: PrismaClient,
  admin?: { email: string; password: string },
) {
  for (const [code, config] of Object.entries(PLAN_CONFIG)) {
    await prisma.plan.upsert({
      where: { code: code as any },
      update: config,
      create: { code: code as any, ...config },
    });
  }
  if (!admin?.email || !admin.password) return { adminSeeded: false };
  const email = normalizeEmail(admin.email);
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await hashPassword(admin.password);
    user = await prisma.user.create({ data: { email, passwordHash, role: "ADMIN" } });
  } else if (user.role !== "ADMIN") {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }
  const plan = await prisma.plan.findUniqueOrThrow({ where: { code: "FREE" } });
  const activePlan = await prisma.userPlan.findFirst({
    where: { userId: user.id, active: true },
  });
  if (!activePlan)
    await prisma.userPlan.create({
      data: { userId: user.id, planId: plan.id },
    });
  return { adminSeeded: true, adminId: user.id };
}
