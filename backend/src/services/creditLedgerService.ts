import { prisma } from '../db/prisma';
import { creditCostService } from './creditCostService';
import { FREE_SERVICE_LIMITS } from '../config/freeServiceLimits';

// Legacy name retained for compatibility. Server execution is creditless:
// `reserve`/`settle` no longer read balances or write CreditLedger entries.
// They only record technical ProcessingUsage rows for fair-use/resource
// accounting. `balance`/`estimate` remain for the legacy credit endpoints and
// are pending retirement in a later toolkit task.
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

  /**
   * Creditless reservation: records technical usage only and enforces the
   * centralized free-service concurrency/size safeguards. No plan or balance
   * is required. Credit columns are written with neutral zeros because the
   * current Prisma schema still requires them.
   */
  async reserve(userId: string, jobId: string, toolId: string, inputBytes: number, isAdmin: boolean, _options = {}) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.processingUsage.findUnique({ where: { jobId } });
      if (existing) return existing;
      if (inputBytes > FREE_SERVICE_LIMITS.maxUploadSizeBytes) throw new Error('El archivo excede el límite de tamaño permitido.');
      const concurrent = await tx.processingUsage.count({ where: { userId, status: { in: ['RESERVED', 'ADMIN_TEST'] } } });
      const concurrentLimit = isAdmin ? FREE_SERVICE_LIMITS.adminMaxConcurrentServerJobs : FREE_SERVICE_LIMITS.maxConcurrentServerJobs;
      if (concurrent >= concurrentLimit) throw new Error('Ya tienes varios procesos en curso. Espera a que termine uno.');
      return tx.processingUsage.create({
        data: {
          userId,
          jobId,
          toolId,
          inputBytes: BigInt(inputBytes),
          estimatedCredits: 0,
          reservedCredits: 0,
          status: isAdmin ? 'ADMIN_TEST' : 'RESERVED',
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  /**
   * Creditless settlement: updates the technical usage status only. No
   * RESERVATION/CONSUMPTION/REFUND ledger entries are written.
   */
  async settle(jobId: string, outcome: 'COMPLETED' | 'FAILED' | 'CANCELLED') {
    return prisma.$transaction(async (tx) => {
      const usage = await tx.processingUsage.findUniqueOrThrow({ where: { jobId } });
      if (usage.status === 'ADMIN_TEST') return tx.processingUsage.update({ where: { jobId }, data: { status: outcome === 'COMPLETED' ? 'COMPLETED' : outcome } });
      if (usage.status !== 'RESERVED') return usage;
      return tx.processingUsage.update({ where: { jobId }, data: { status: outcome, consumedCredits: 0 } });
    });
  }
}
export const creditLedgerService = new CreditLedgerService();
