import { prisma } from '../db/prisma';
import { collectHealth } from './healthService';
import {
  deriveServiceStatusState,
  normalizeServiceStatusMessage,
  type ServiceHealthSnapshot,
  type ServiceStatusState,
} from '../config/serviceStatus';

type HealthReader = () => Promise<ServiceHealthSnapshot | null>;

// Fixed sentinel key. `ServiceStatus.singleton` is UNIQUE, so every write goes
// through the same row and the database itself prevents multiple active rows.
export const SERVICE_STATUS_SINGLETON = 'current';

export interface PublicServiceStatus {
  state: ServiceStatusState;
  message: string | null;
}

export interface AdminServiceStatus extends PublicServiceStatus {
  persisted: boolean;
  updatedAt: Date | null;
}

export class ServiceStatusService {
  constructor(private readonly healthReader: HealthReader = async () => collectHealth()) {}

  async readPersisted() {
    return prisma.serviceStatus.findFirst({
      where: { singleton: SERVICE_STATUS_SINGLETON },
      select: { state: true, message: true, updatedAt: true },
    });
  }

  /**
   * Public product status. A persisted administrator state wins; otherwise it
   * falls back to the real health-derived state. A missing table or an
   * unavailable database degrades to the health fallback instead of failing.
   */
  async getPublicStatus(): Promise<PublicServiceStatus> {
    const persisted = await this.readPersisted().catch(() => null);
    if (persisted) return { state: persisted.state, message: persisted.message };
    const health = await this.healthReader().catch(() => null);
    return { state: deriveServiceStatusState(health), message: null };
  }

  async getAdminStatus(): Promise<AdminServiceStatus> {
    const persisted = await this.readPersisted().catch(() => null);
    if (persisted) {
      return { state: persisted.state, message: persisted.message, persisted: true, updatedAt: persisted.updatedAt };
    }
    const health = await this.healthReader().catch(() => null);
    return { state: deriveServiceStatusState(health), message: null, persisted: false, updatedAt: null };
  }

  async updateStatus(adminId: string, state: ServiceStatusState, message: string | null) {
    const normalized = normalizeServiceStatusMessage(message);
    return prisma.$transaction(async (tx) => {
      const saved = await tx.serviceStatus.upsert({
        where: { singleton: SERVICE_STATUS_SINGLETON },
        create: { singleton: SERVICE_STATUS_SINGLETON, state, message: normalized, updatedById: adminId },
        update: { state, message: normalized, updatedById: adminId },
        select: { state: true, message: true, updatedAt: true },
      });
      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: 'SERVICE_STATUS_UPDATED',
          reason: `Estado del servicio: ${state}`,
          metadata: { state, hasMessage: Boolean(normalized) },
        },
      });
      return saved;
    });
  }
}

export const serviceStatusService = new ServiceStatusService();
