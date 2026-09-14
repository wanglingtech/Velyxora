import { prisma } from '../db/prisma';
import { BETA_PACKAGES, BetaPackageId } from '../config/betaPayments';

export class PaymentService {
  async listOrders(userId: string) {
    return prisma.paymentOrder.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, status: true, credits: true, amountMinor: true, currency: true, reference: true, createdAt: true, updatedAt: true, plan: { select: { code: true } } } });
  }
  async createOrder(userId: string, data: { packageId: BetaPackageId; idempotencyKey: string }) {
    if (process.env.BETA_MANUAL_PAYMENTS !== 'true') throw new Error('Los pagos manuales beta no están habilitados.');
    const selected = BETA_PACKAGES[data.packageId];
    if (!selected || !data.idempotencyKey) throw new Error('Paquete o idempotency key inválido.');
    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: selected.planCode } });
    return prisma.paymentOrder.upsert({ where: { userId_idempotencyKey: { userId, idempotencyKey: data.idempotencyKey } }, update: {}, create: { userId, planId: plan.id, credits: selected.credits, amountMinor: selected.amountMinor, currency: selected.currency, idempotencyKey: data.idempotencyKey } });
  }
  async submitReference(userId: string, orderId: string, reference: string) {
    if (!/^[A-Za-z0-9-]{4,64}$/.test(reference)) throw new Error('Referencia inválida.');
    const result = await prisma.paymentOrder.updateMany({ where: { id: orderId, userId, status: 'PENDING_PAYMENT' }, data: { reference, status: 'PENDING_REVIEW' } });
    if (result.count !== 1) throw new Error('La orden no admite referencias en su estado actual.');
    return prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
  }
  async review(adminId: string, orderId: string, approve: boolean, reason: string) {
    if (reason.trim().length < 3) throw new Error('Se requiere una razón.');
    return prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status === 'APPROVED' || order.status === 'REJECTED') return order;
      if (order.status !== 'PENDING_REVIEW') throw new Error('La orden no está pendiente de revisión.');
      const status = approve ? 'APPROVED' : 'REJECTED';
      const claimed = await tx.paymentOrder.updateMany({ where: { id: orderId, status: 'PENDING_REVIEW' }, data: { status } });
      if (claimed.count !== 1) return tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
      const payment = await tx.payment.create({ data: { orderId, status, reviewedBy: adminId, reviewReason: reason.trim() } });
      if (approve) {
        await tx.creditLedger.create({ data: { userId: order.userId, amount: order.credits, type: 'PURCHASE', reason: 'Pago manual Yape aprobado', paymentId: payment.id, idempotencyKey: `payment:${order.id}` } });
        if (order.planId) { await tx.userPlan.updateMany({ where: { userId: order.userId, active: true }, data: { active: false, endsAt: new Date() } }); await tx.userPlan.create({ data: { userId: order.userId, planId: order.planId } }); }
      }
      await tx.adminAuditLog.create({ data: { adminId, targetUserId: order.userId, action: `PAYMENT_${status}`, reason: reason.trim(), metadata: { orderId } } });
      return tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
    }, { isolationLevel: 'Serializable' });
  }
}
export const paymentService = new PaymentService();
