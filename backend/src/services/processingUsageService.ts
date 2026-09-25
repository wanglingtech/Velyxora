import { prisma } from '../db/prisma';
import { FREE_SERVICE_LIMITS } from '../config/freeServiceLimits';

export type ProcessingUsageOutcome = 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Neutral operational/resource accounting for the free service. This service
// enforces the centralized free-service concurrency/size safeguards and owns
// the ProcessingUsage lifecycle. It performs no billing, quotas or credits.
export class ProcessingUsageService {
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
          status: isAdmin ? 'ADMIN_TEST' : 'RESERVED',
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async settle(jobId: string, outcome: ProcessingUsageOutcome) {
    return prisma.$transaction(async (tx) => {
      const usage = await tx.processingUsage.findUniqueOrThrow({ where: { jobId } });
      if (usage.status === 'ADMIN_TEST') return tx.processingUsage.update({ where: { jobId }, data: { status: outcome === 'COMPLETED' ? 'COMPLETED' : outcome } });
      if (usage.status !== 'RESERVED') return usage;
      return tx.processingUsage.update({ where: { jobId }, data: { status: outcome } });
    });
  }
}
export const processingUsageService = new ProcessingUsageService();
