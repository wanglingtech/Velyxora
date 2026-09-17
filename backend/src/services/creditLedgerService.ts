import { prisma } from '../db/prisma';
import { creditCostService } from './creditCostService';
import { PLAN_CONFIG } from '../config/plans';

export class CreditLedgerService {
  async balance(userId: string, tx: any = prisma) {
    const result = await tx.creditLedger.aggregate({ where: { userId }, _sum: { amount: true } });
    return result._sum.amount ?? 0;
  }

  async estimate(userId: string, toolId: string, inputBytes: number, options = {}) {
    const cost = creditCostService.estimate(toolId, inputBytes, options);
    const currentBalance = await this.balance(userId);
    return { ...cost, currentBalance, balanceAfter: currentBalance - cost.estimatedCredits };
  }

  async reserve(userId: string, jobId: string, toolId: string, inputBytes: number, isAdmin: boolean, options = {}) {
    const cost = creditCostService.estimate(toolId, inputBytes, options);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.processingUsage.findUnique({ where: { jobId } });
      if (existing) return existing;
      const userPlan = await tx.userPlan.findFirst({ where: { userId, active: true }, include: { plan: true } });
      if (!userPlan) throw new Error('El usuario no tiene un plan activo.');
      if (inputBytes > userPlan.plan.maxUploadSize) throw new Error('El archivo excede el límite del plan.');
      const concurrent = await tx.processingUsage.count({ where: { userId, status: { in: ['RESERVED', 'ADMIN_TEST'] } } });
      const technicalMax = Math.max(...Object.values(PLAN_CONFIG).map((plan) => plan.maxConcurrentJobs));
      const concurrentLimit = isAdmin ? technicalMax : userPlan.plan.maxConcurrentJobs;
      if (concurrent >= concurrentLimit) throw new Error('Ya tienes varios procesos en curso. Espera a que termine uno.');
      const balance = await this.balance(userId, tx);
      if (!isAdmin && balance < cost.estimatedCredits) throw new Error('Créditos insuficientes.');
      if (isAdmin) {
        await tx.creditLedger.create({ data: { userId, amount: 0, type: 'ADMIN_TEST', reason: `Prueba administrativa; costo estimado ${cost.estimatedCredits}`, toolId, jobId, idempotencyKey: `admin-test:${jobId}` } });
        return tx.processingUsage.create({ data: { userId, jobId, toolId, inputBytes: BigInt(inputBytes), estimatedCredits: cost.estimatedCredits, reservedCredits: 0, status: 'ADMIN_TEST' } });
      }
      if (cost.estimatedCredits > 0) await tx.creditLedger.create({ data: { userId, amount: -cost.estimatedCredits, type: 'RESERVATION', reason: 'Reserva previa al procesamiento', toolId, jobId, idempotencyKey: `reserve:${jobId}` } });
      return tx.processingUsage.create({ data: { userId, jobId, toolId, inputBytes: BigInt(inputBytes), estimatedCredits: cost.estimatedCredits, reservedCredits: cost.estimatedCredits, status: 'RESERVED' } });
    }, { isolationLevel: 'Serializable' });
  }

  async settle(jobId: string, outcome: 'COMPLETED' | 'FAILED' | 'CANCELLED') {
    return prisma.$transaction(async (tx) => {
      const usage = await tx.processingUsage.findUniqueOrThrow({ where: { jobId } });
      if (usage.status === 'ADMIN_TEST') return tx.processingUsage.update({ where: { jobId }, data: { status: outcome === 'COMPLETED' ? 'COMPLETED' : outcome } });
      if (usage.status !== 'RESERVED') return usage;
      if (outcome === 'COMPLETED') {
        if (usage.reservedCredits > 0) await tx.creditLedger.create({ data: { userId: usage.userId, amount: 0, type: 'CONSUMPTION', reason: 'Reserva confirmada como consumo', toolId: usage.toolId, jobId, idempotencyKey: `consume:${jobId}` } });
        return tx.processingUsage.update({ where: { jobId }, data: { status: 'COMPLETED', consumedCredits: usage.reservedCredits } });
      }
      if (usage.reservedCredits > 0) await tx.creditLedger.create({ data: { userId: usage.userId, amount: usage.reservedCredits, type: 'REFUND', reason: outcome === 'CANCELLED' ? 'Cancelación: reserva liberada íntegramente' : 'Fallo: reserva liberada íntegramente', toolId: usage.toolId, jobId, idempotencyKey: `refund:${jobId}` } });
      return tx.processingUsage.update({ where: { jobId }, data: { status: outcome } });
    });
  }
}
export const creditLedgerService = new CreditLedgerService();
