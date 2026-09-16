import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import { createBackendApp } from '../src/app';
import { hashPassword, verifyPassword } from '../src/security/password';
import { PLAN_CONFIG } from '../src/config/plans';
import { creditCostService } from '../src/services/creditCostService';
import { providerPolicyService } from '../src/services/providerPolicyService';
import { requireRole } from '../src/middleware/auth';
import { normalizePeruPhone, paymentService } from '../src/services/paymentService';
import { prisma } from '../src/db/prisma';
import { authService, identityHash, SESSION_COOKIE } from '../src/services/authService';
import { randomUUID } from 'node:crypto';
import { seedInitialData } from '../src/services/seedService';

test('anon en endpoint USER protegido recibe 401', async () => {
  const response = await request(createBackendApp()).get('/api/auth/me');
  assert.equal(response.status, 401);
});

test('autorización USER→ADMIN 403 y ADMIN permitido', () => {
  const middleware = requireRole('ADMIN');
  const response = () => { const state: any = {}; return { state, status(code: number) { state.code = code; return this; }, json(body: any) { state.body = body; return this; } }; };
  const denied = response(); middleware({ auth: { role: 'USER' } } as any, denied as any, () => assert.fail('USER no debe continuar')); assert.equal(denied.state.code, 403);
  let allowed = false; middleware({ auth: { role: 'ADMIN' } } as any, response() as any, () => { allowed = true; }); assert.equal(allowed, true);
});

test('password usa scrypt con salt y valida sin texto plano', async () => {
  const a = await hashPassword('Una-clave-segura-123'); const b = await hashPassword('Una-clave-segura-123');
  assert.notEqual(a, b); assert.equal(a.includes('Una-clave'), false); assert.equal(await verifyPassword('Una-clave-segura-123', a), true); assert.equal(await verifyPassword('incorrecta', a), false);
});

test('seed admin crea, diagnostica mismatch y solo rota password con opt-in explícito', async () => {
  const suffix = randomUUID();
  const email = `seed-admin-${suffix}@example.invalid`;
  const initialPassword = 'Admin-inicial-seguro-123';
  const replacementPassword = 'Admin-reemplazo-seguro-456';
  try {
    const created = await seedInitialData(prisma, { email, password: initialPassword });
    assert.equal(created.action, 'CREATED');
    assert.equal(created.role, 'ADMIN');
    assert.equal(created.status, 'ACTIVE');
    assert.equal(created.passwordMatches, true);

    const before = await prisma.user.findUniqueOrThrow({ where: { email } });
    const mismatch = await seedInitialData(prisma, { email, password: replacementPassword });
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(mismatch.action, 'EXISTING');
    assert.equal(mismatch.passwordMatches, false);
    assert.equal(unchanged.passwordHash, before.passwordHash);
    assert.equal(await verifyPassword(initialPassword, unchanged.passwordHash), true);

    const updated = await seedInitialData(prisma, { email, password: replacementPassword, updateExistingPassword: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(updated.action, 'PASSWORD_UPDATED_EXPLICITLY');
    assert.equal(updated.passwordMatches, true);
    assert.notEqual(after.passwordHash, before.passwordHash);
    assert.equal(await verifyPassword(replacementPassword, after.passwordHash), true);
  } finally {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.userPlan.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

test('referencia Yape Perú acepta solo nueve dígitos y normaliza bordes', () => {
  assert.equal(normalizePeruPhone(' 968555200 '), '968555200');
  for (const value of ['968 555 200', '+51968555200', '96855520', '9685552000', 'abcdefghi', '<script>1']) assert.throws(() => normalizePeruPhone(value), /9 dígitos/);
});

test('reclamo, sugerencia, ownership, respuesta admin y ban persisten con seguridad', async () => {
  const suffix = randomUUID(); const userEmail = `beta-user-${suffix}@example.invalid`; const adminEmail = `beta-admin-${suffix}@example.invalid`;
  const user = await prisma.user.create({ data: { email: userEmail, passwordHash: 'test-only', displayName: 'Beta User' } });
  const admin = await prisma.user.create({ data: { email: adminEmail, passwordHash: 'test-only', displayName: 'Beta Admin', role: 'ADMIN' } });
  const userSession = await authService.createSession(user.id); const adminSession = await authService.createSession(admin.id);
  const cookie = (token: string) => `${SESSION_COOKIE}=${token}`;
  try {
    const app = createBackendApp();
    const complaint = await request(app).post('/api/feedback/complaints').set('Cookie', cookie(userSession.token)).send({ claimantName: 'Beta User', documentId: '12345678', phone: '968555200', email: userEmail, type: 'RECLAMO', serviceDescription: 'Paquete de créditos beta', subject: 'Cobro pendiente', detail: 'Necesito revisar el estado real de una operación de pago.', consumerRequest: 'Solicito confirmar el estado de la operación.' });
    assert.equal(complaint.status, 201); assert.match(complaint.body.data.trackingCode, /^VX-/);
    const suggestion = await request(app).post('/api/feedback/suggestions').set('Cookie', cookie(userSession.token)).set('X-CSRF-Token', userSession.csrf).send({ category: 'MEJORA', title: 'Mejor navegación', description: 'Agregar accesos más claros dentro de la cuenta.' });
    assert.equal(suggestion.status, 201);
    const mine = await request(app).get('/api/feedback/suggestions/mine').set('Cookie', cookie(userSession.token)); assert.equal(mine.status, 200); assert.equal(mine.body.data.some((item: any) => item.id === suggestion.body.data.id), true);
    const anonAdmin = await request(app).get('/api/admin/suggestions'); assert.equal(anonAdmin.status, 401);
    const responded = await request(app).patch(`/api/admin/suggestions/${suggestion.body.data.id}`).set('Cookie', cookie(adminSession.token)).set('X-CSRF-Token', adminSession.csrf).send({ status: 'REVIEWING', response: 'La revisaremos.', reaction: '💡' }); assert.equal(responded.status, 200); assert.equal(responded.body.data.reaction, '💡');
    const order = await prisma.paymentOrder.create({ data: { userId: user.id, credits: 25, amountMinor: 500, currency: 'PEN', status: 'PENDING_REVIEW', reference: '968555200', idempotencyKey: `test:${suffix}` } }); await paymentService.review(admin.id, order.id, true, 'Pago validado en prueba'); await paymentService.review(admin.id, order.id, true, 'Segundo intento'); assert.equal(await prisma.creditLedger.count({ where: { idempotencyKey: `payment:${order.id}` } }), 1);
    const cancellable = await prisma.paymentOrder.create({ data: { userId: user.id, credits: 10, amountMinor: 200, currency: 'PEN', idempotencyKey: `cancel:${suffix}` } }); const cancelled = await paymentService.cancelOrder(user.id, cancellable.id); assert.equal(cancelled.status, 'CANCELLED_BY_USER'); assert.equal((await paymentService.cancelOrder(user.id, cancellable.id)).status, 'CANCELLED_BY_USER');
    const banned = await request(app).post(`/api/admin/users/${user.id}/moderate`).set('Cookie', cookie(adminSession.token)).set('X-CSRF-Token', adminSession.csrf).send({ action: 'BAN', reason: 'Prueba automatizada de moderación beta' }); assert.equal(banned.status, 200);
    assert.equal(await authService.resolve(userSession.token), null); assert.ok(await prisma.deniedIdentity.findUnique({ where: { emailHash: identityHash(userEmail) } })); await assert.rejects(() => authService.register(userEmail, 'Una-clave-segura-123', 'Duplicado vetado'), /identificador/);
  } finally {
    await prisma.adminAuditLog.deleteMany({ where: { OR: [{ adminId: admin.id }, { targetUserId: user.id }] } }); await prisma.creditLedger.deleteMany({ where: { userId: user.id } }); await prisma.payment.deleteMany({ where: { order: { userId: user.id } } }); await prisma.paymentOrder.deleteMany({ where: { userId: user.id } }); await prisma.suggestion.deleteMany({ where: { userId: user.id } }); await prisma.complaint.deleteMany({ where: { userId: user.id } }); await prisma.deniedIdentity.deleteMany({ where: { emailHash: identityHash(userEmail) } }); await prisma.session.deleteMany({ where: { userId: { in: [user.id, admin.id] } } }); await prisma.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } });
  }
});

test('rate limit de feedback bloquea spam con 429', async () => {
  const app = createBackendApp(); let limited = false;
  for (let index = 0; index < 35; index++) { const response = await request(app).post('/api/feedback/complaints').send({}); if (response.status === 429) { limited = true; break; } }
  assert.equal(limited, true);
});

test('planes y costos: FREE existe, LOCAL cero y SERVER escala por tamaño', () => {
  assert.equal(PLAN_CONFIG.FREE.maxConcurrentJobs, 1);
  assert.equal(creditCostService.estimate('json-formatter', 10).estimatedCredits, 0);
  assert.equal(creditCostService.estimate('video-to-mp3', 1).estimatedCredits, 2);
  assert.equal(creditCostService.estimate('video-to-mp3', 60 * 1024 * 1024).estimatedCredits, 4);
});

test('policy permite allowlist y bloquea adulto, desconocido y subdominio engañoso', () => {
  assert.equal(providerPolicyService.resolve('https://www.youtube.com/watch?v=abc'), 'youtube');
  for (const url of ['https://xvideos.com/a', 'https://example.com/a', 'https://youtube.com.attacker.example/a']) assert.throws(() => providerPolicyService.assertAllowed(url), /no está admitido/);
});

test('schema y migración contienen persistencia e idempotencia requeridas', async () => {
  const [schema, migration] = await Promise.all([readFile('prisma/schema.prisma', 'utf8'), readFile('prisma/migrations/20260913000100_auth_credits_beta/migration.sql', 'utf8')]);
  for (const model of ['User','Session','Plan','UserPlan','CreditLedger','ProcessingUsage','ProcessingHistory','PaymentOrder','Payment','AdminAuditLog','DeniedIdentity','Complaint','Suggestion']) assert.match(schema, new RegExp(`model ${model}`));
  assert.match(migration, /idempotencyKey.*UNIQUE/); assert.match(schema, /ADMIN_TEST/);
  assert.match(schema, /BANNED/); assert.match(schema, /ANONYMIZED/); assert.match(schema, /onDelete: Restrict/);
});
