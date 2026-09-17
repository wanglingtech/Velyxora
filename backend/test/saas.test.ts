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
import { isSafeRedirectTarget, validateShortLinkTarget } from '../src/services/shortLinkService';
import { validateUploadMetadata } from '../src/security/uploadPolicy';
import { effectiveUploadLimit } from '../src/middleware/uploadHandler';

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

test('shortener distingue resolución, expiración y conserva destinos completos', async () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const expiredSlug = `e${suffix}`;
  const targetUrl = 'https://www.youtube.com/watch?v=6HJjhZ-jloI&list=RD6HJjhZ-jloI&start_radio=1#details';
  await prisma.shortLink.create({ data: { slug: expiredSlug, targetUrl, expiresAt: new Date(Date.now() - 1000) } });
  let activeSlug = '';
  try {
    const app = createBackendApp();
    const before = Date.now();
    const created = await request(app).post('/api/links').send({ url: targetUrl, expiresInDays: 365 });
    assert.equal(created.status, 201);
    activeSlug = created.body.data.slug;
    assert.ok(activeSlug.length >= 16, 'los slugs nuevos deben contener al menos 96 bits base64url');
    assert.equal(created.body.data.targetUrl, targetUrl);
    const expiresAt = new Date(created.body.data.expiresAt).getTime();
    assert.ok(expiresAt >= before + 365 * 86400000 - 2000 && expiresAt <= Date.now() + 365 * 86400000 + 2000);
    const resolved = await request(app).get(`/api/links/${activeSlug}`);
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.data.targetUrl, targetUrl);
    assert.equal((await prisma.shortLink.findUniqueOrThrow({ where: { slug: activeSlug } })).clicks, 1);
    assert.equal((await request(app).get(`/api/links/${expiredSlug}`)).status, 410);
    assert.equal((await request(app).get('/api/links/unknown1')).status, 404);
    const redirect = await request(app).get(`/s/${activeSlug}`).redirects(0);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.location, targetUrl);
  } finally {
    await prisma.shortLink.deleteMany({ where: { slug: { in: [activeSlug, expiredSlug].filter(Boolean) } } });
  }
});

test('shortener rechaza esquemas peligrosos sin solicitar el destino', () => {
  assert.equal(isSafeRedirectTarget('https://example.com/path?a=1&b=2#ok'), true);
  assert.equal(isSafeRedirectTarget('http://example.com'), true);
  for (const target of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://example.com/x', 'vbscript:msgbox(1)']) assert.equal(isSafeRedirectTarget(target), false);
});

test('shortener universal valida solo sintaxis/protocolo sin DNS ni allowlist temática', () => {
  assert.equal(validateShortLinkTarget('https://dominio-desconocido.invalid/ruta?x=1#fragmento').valid, true);
  assert.equal(validateShortLinkTarget('https://adult.example/contenido').valid, true);
  assert.equal(validateShortLinkTarget(`https://example.com/${'a'.repeat(5000)}`).valid, false);
  assert.equal(validateShortLinkTarget('https://example.com/ok\u0000no').valid, false);
});

test('shortener distingue enlace deshabilitado y reportes no lo deshabilitan automáticamente', async () => {
  const slug = `d${randomUUID().replace(/-/g, '').slice(0, 15)}`;
  const link = await prisma.shortLink.create({ data: { slug, targetUrl: 'https://example.invalid/' } });
  try {
    const app = createBackendApp();
    const report = await request(app).post(`/api/links/${slug}/reports`).send({ category: 'PHISHING', detail: 'Reporte controlado de prueba' });
    assert.equal(report.status, 201);
    assert.equal((await prisma.shortLink.findUniqueOrThrow({ where: { slug } })).status, 'ACTIVE');
    await prisma.shortLink.update({ where: { id: link.id }, data: { status: 'DISABLED', disabledAt: new Date(), disabledReason: 'Moderación de prueba' } });
    const resolved = await request(app).get(`/api/links/${slug}`);
    assert.equal(resolved.status, 410);
    assert.equal(resolved.body.error.code, 'SHORT_LINK_DISABLED');
  } finally { await prisma.shortLinkReport.deleteMany({ where: { shortLinkId: link.id } }); await prisma.shortLink.delete({ where: { id: link.id } }); }
});

test('CSRF de sesión permanece estable entre pestañas', async () => {
  const email = `csrf-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({ data: { email, passwordHash: 'test-only', displayName: 'CSRF Test' } });
  const session = await authService.createSession(user.id);
  try {
    const first = await authService.getOrCreateCsrf((await authService.resolve(session.token))!.id, session.csrf);
    const second = await authService.getOrCreateCsrf((await authService.resolve(session.token))!.id, (await authService.resolve(session.token))!.csrfToken);
    assert.equal(first, second);
    assert.equal(authService.verifyCsrf((await authService.resolve(session.token))!, first), true);
  } finally { await prisma.session.deleteMany({ where: { userId: user.id } }); await prisma.user.delete({ where: { id: user.id } }); }
});

test('API del shortener rechaza protocolos peligrosos', async () => {
  const app = createBackendApp();
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'ftp://example.com/x', 'vbscript:msgbox(1)']) {
    const response = await request(app).post('/api/links').send({ url, expiresInDays: 30 });
    assert.equal(response.status, 400, url);
    assert.equal(response.body.error.code, 'INVALID_URL');
  }
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

test('límites efectivos separan ADMIN local de ADMIN producción sin alterar planes', () => {
  const productionHardLimit = 100 * 1024 * 1024;
  const localAdminHardLimit = 1024 * 1024 * 1024;
  assert.equal(PLAN_CONFIG.FREE.monthlyCredits, 25);
  assert.equal(PLAN_CONFIG.PLUS.monthlyCredits, 300);
  assert.equal(PLAN_CONFIG.PRO.monthlyCredits, 1200);
  assert.equal(effectiveUploadLimit(PLAN_CONFIG.FREE.maxUploadSize, false, productionHardLimit, 'development', localAdminHardLimit), PLAN_CONFIG.FREE.maxUploadSize);
  assert.equal(effectiveUploadLimit(PLAN_CONFIG.PRO.maxUploadSize, false, productionHardLimit, 'development', localAdminHardLimit), productionHardLimit);
  assert.equal(effectiveUploadLimit(PLAN_CONFIG.FREE.maxUploadSize, true, productionHardLimit, 'development', localAdminHardLimit), localAdminHardLimit);
  assert.equal(effectiveUploadLimit(PLAN_CONFIG.FREE.maxUploadSize, true, productionHardLimit, 'production', localAdminHardLimit), productionHardLimit);
});

test('política backend vincula formato a herramienta sin depender de accept', () => {
  assert.equal(validateUploadMetadata('word-to-pdf', 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').valid, true);
  assert.equal(validateUploadMetadata('word-to-pdf', 'video.mp4', 'video/mp4').valid, false);
  assert.equal(validateUploadMetadata('video-to-mp3', 'document.pdf', 'application/pdf').valid, false);
  assert.equal(validateUploadMetadata('mp4-to-webm', 'video.webm', 'video/webm').valid, false);
});

test('bypass comercial ADMIN no altera la validación de seguridad por herramienta', () => {
  assert.equal(validateUploadMetadata('word-to-pdf', 'video.mp4', 'video/mp4').valid, false);
  assert.equal(validateUploadMetadata('word-to-pdf', 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').valid, true);
  assert.equal(validateUploadMetadata('video-to-mp3', 'document.pdf', 'application/pdf').valid, false);
  assert.equal(validateUploadMetadata('audio-normalize', 'payload.exe', 'application/octet-stream').valid, false);
  assert.equal(validateUploadMetadata('audio-normalize', 'recording.mp3', 'audio/mpeg').valid, true);
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
