import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import { createBackendApp } from '../src/app';
import { hashPassword, verifyPassword } from '../src/security/password';
import { providerPolicyService } from '../src/services/providerPolicyService';
import { requireRole } from '../src/middleware/auth';
import { prisma } from '../src/db/prisma';
import { authService, identityHash, SESSION_COOKIE } from '../src/services/authService';
import { randomUUID } from 'node:crypto';
import { seedInitialData } from '../src/services/seedService';
import { isSafeRedirectTarget, validateShortLinkTarget } from '../src/services/shortLinkService';
import { validateUploadMetadata } from '../src/security/uploadPolicy';
import { effectiveUploadLimit } from '../src/middleware/uploadHandler';
import { processingUsageService } from '../src/services/processingUsageService';
import { FREE_SERVICE_LIMITS } from '../src/config/freeServiceLimits';

test('anon en endpoint USER protegido recibe 401', async () => {
  const response = await request(createBackendApp()).get('/api/auth/me');
  assert.equal(response.status, 401);
});

test('login real reutiliza la cookie en auth/me, account, payments y media analyze', async () => {
  const suffix = randomUUID();
  const email = `session-flow-${suffix}@example.invalid`;
  const password = 'Session-flow-seguro-123';
  await seedInitialData(prisma);
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), displayName: 'Session Flow' } });
  try {
    const agent = request.agent(createBackendApp());
    const login = await agent.post('/api/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    assert.match(String(login.headers['set-cookie']?.[0]), new RegExp(`^${SESSION_COOKIE}=`));
    assert.ok(login.body.data.csrf);

    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, email);
    assert.equal((await agent.get('/api/account')).status, 200);

    const analyze = await agent
      .post('/api/media/analyze')
      .set('X-CSRF-Token', login.body.data.csrf)
      .send({ url: 'https://example.com/not-allowlisted' });
    assert.equal(analyze.status, 422);
    assert.equal(analyze.body.error.code, 'ANALYSIS_FAILED');
  } finally {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
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
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
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
    const banned = await request(app).post(`/api/admin/users/${user.id}/moderate`).set('Cookie', cookie(adminSession.token)).set('X-CSRF-Token', adminSession.csrf).send({ action: 'BAN', reason: 'Prueba automatizada de moderación beta' }); assert.equal(banned.status, 200);
    assert.equal(await authService.resolve(userSession.token), null); assert.ok(await prisma.deniedIdentity.findUnique({ where: { emailHash: identityHash(userEmail) } })); await assert.rejects(() => authService.register(userEmail, 'Una-clave-segura-123', 'Duplicado vetado'), /identificador/);
  } finally {
    await prisma.adminAuditLog.deleteMany({ where: { OR: [{ adminId: admin.id }, { targetUserId: user.id }] } }); await prisma.suggestion.deleteMany({ where: { userId: user.id } }); await prisma.complaint.deleteMany({ where: { userId: user.id } }); await prisma.deniedIdentity.deleteMany({ where: { emailHash: identityHash(userEmail) } }); await prisma.session.deleteMany({ where: { userId: { in: [user.id, admin.id] } } }); await prisma.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } });
  }
});

test('rate limit de feedback bloquea spam con 429', async () => {
  const app = createBackendApp(); let limited = false;
  for (let index = 0; index < 35; index++) { const response = await request(app).post('/api/feedback/complaints').send({}); if (response.status === 429) { limited = true; break; } }
  assert.equal(limited, true);
});

test('el límite efectivo de subida parte de FREE_SERVICE_LIMITS y separa ADMIN local de producción', () => {
  const base = FREE_SERVICE_LIMITS.maxUploadSizeBytes;
  const largerHardLimit = base * 2;
  const productionHardLimit = Math.floor(base / 2);
  const localAdminHardLimit = base * 10;
  assert.equal(effectiveUploadLimit(base, false, largerHardLimit, 'development', localAdminHardLimit), base);
  assert.equal(effectiveUploadLimit(base, false, productionHardLimit, 'development', localAdminHardLimit), productionHardLimit);
  assert.equal(effectiveUploadLimit(base, true, largerHardLimit, 'development', localAdminHardLimit), localAdminHardLimit);
  assert.equal(effectiveUploadLimit(base, true, largerHardLimit, 'production', localAdminHardLimit), largerHardLimit);
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

test('schema contiene la persistencia necesaria y retiró los modelos comerciales', async () => {
  const [schema, migration] = await Promise.all([readFile('prisma/schema.prisma', 'utf8'), readFile('prisma/migrations/20260913000100_auth_credits_beta/migration.sql', 'utf8')]);
  for (const model of ['User','Session','ProcessingUsage','ProcessingHistory','AdminAuditLog','DeniedIdentity','Complaint','Suggestion','ShortLink','ShortLinkReport','ProviderCircuitBreaker','ServiceStatus']) assert.match(schema, new RegExp(`model ${model}`));
  for (const removed of ['Plan','UserPlan','CreditLedger','PaymentOrder','Payment']) assert.doesNotMatch(schema, new RegExp(`model ${removed}\\b`), `el schema no debe definir el modelo ${removed}`);
  for (const removedEnum of ['PlanCode','LedgerType','PaymentOrderStatus','PaymentStatus']) assert.doesNotMatch(schema, new RegExp(`enum ${removedEnum}\\b`), `el schema no debe definir el enum ${removedEnum}`);
  assert.match(migration, /idempotencyKey.*UNIQUE/); assert.match(schema, /ADMIN_TEST/);
  assert.match(schema, /BANNED/); assert.match(schema, /ANONYMIZED/); assert.match(schema, /onDelete: Restrict/);
});

test('existe la migración destructiva que retira el esquema comercial en orden FK-safe', async () => {
  const sql = await readFile('prisma/migrations/20260926000100_retire_commercial_models/migration.sql', 'utf8');
  for (const table of ['CreditLedger', 'Payment', 'PaymentOrder', 'UserPlan', 'Plan']) {
    assert.match(sql, new RegExp(`DROP TABLE "${table}"`), `la migración debe retirar la tabla ${table}`);
  }
  for (const type of ['LedgerType', 'PaymentStatus', 'PaymentOrderStatus', 'PlanCode']) {
    assert.match(sql, new RegExp(`DROP TYPE "${type}"`), `la migración debe retirar el enum ${type}`);
  }
  for (const column of ['creditsCost', 'estimatedCredits', 'reservedCredits', 'consumedCredits']) {
    assert.match(sql, new RegExp(`DROP COLUMN "${column}"`), `la migración debe retirar la columna ${column}`);
  }
  assert.ok(sql.indexOf('DROP TABLE "CreditLedger"') < sql.indexOf('DROP TABLE "Payment"'));
  assert.ok(sql.indexOf('DROP TABLE "Payment"') < sql.indexOf('DROP TABLE "PaymentOrder"'));
  assert.ok(sql.indexOf('DROP TABLE "PaymentOrder"') < sql.indexOf('DROP TABLE "UserPlan"'));
  assert.ok(sql.indexOf('DROP TABLE "UserPlan"') < sql.indexOf('DROP TABLE "Plan"'));
  assert.doesNotMatch(sql, /"ServiceStatus"/, 'la migración comercial no debe tocar ServiceStatus');
});

test('SERVER_REQUIRED exige sesión antes de procesar y la vista pública no la exige', async () => {
  const app = createBackendApp();
  // Public viewing/health endpoints stay accessible without a session.
  assert.equal((await request(app).get('/api/health')).status, 200);
  assert.equal((await request(app).get('/api/tools')).status, 200);
  // requireProcessingAuth bypasses auth only under NODE_ENV=test, so assert the
  // real path outside that seam.
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    assert.equal((await request(app).post('/api/conversions').send({})).status, 401);
    assert.equal((await request(app).post('/api/uploads?toolId=video-to-mp3')).status, 401);
    assert.equal((await request(app).post('/api/media/analyze').send({ url: 'https://www.youtube.com/watch?v=abc' })).status, 401);
    assert.equal((await request(app).post('/api/media/process').send({})).status, 401);
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
});

test('la ejecución de servidor es sin créditos y sin plan activo', async () => {
  const suffix = randomUUID();
  const email = `creditless-${suffix}@example.invalid`;
  const user = await prisma.user.create({ data: { email, passwordHash: 'test-only', displayName: 'Creditless' } });
  const jobId = `job-creditless-${suffix}`;
  try {
    // Server execution is free: no plan or credit records are involved.
    const usage = await processingUsageService.reserve(user.id, jobId, 'video-to-mp3', 2048, false);
    assert.equal(usage.status, 'RESERVED');
    assert.equal(usage.inputBytes, BigInt(2048));
    assert.equal(await prisma.processingUsage.count({ where: { jobId } }), 1);

    await processingUsageService.settle(jobId, 'COMPLETED');
    const settled = await prisma.processingUsage.findUniqueOrThrow({ where: { jobId } });
    assert.equal(settled.status, 'COMPLETED');
  } finally {
    await prisma.processingUsage.deleteMany({ where: { jobId } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('los límites de servicio gratuito protegen concurrencia y tamaño sin plan', async () => {
  const suffix = randomUUID();
  const email = `free-limits-${suffix}@example.invalid`;
  const user = await prisma.user.create({ data: { email, passwordHash: 'test-only', displayName: 'Free Limits' } });
  const base = `job-limits-${suffix}`;
  try {
    for (let index = 0; index < FREE_SERVICE_LIMITS.maxConcurrentServerJobs; index += 1) {
      await processingUsageService.reserve(user.id, `${base}-${index}`, 'video-to-mp3', 1024, false);
    }
    await assert.rejects(
      () => processingUsageService.reserve(user.id, `${base}-overflow`, 'video-to-mp3', 1024, false),
      /procesos en curso/,
    );
    await assert.rejects(
      () => processingUsageService.reserve(user.id, `${base}-big`, 'video-to-mp3', FREE_SERVICE_LIMITS.maxUploadSizeBytes + 1, false),
      /límite de tamaño/,
    );
  } finally {
    await prisma.processingUsage.deleteMany({ where: { jobId: { startsWith: base } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('el registro crea solo la cuenta y el schema ya no define modelos comerciales', async () => {
  const email = `register-free-${randomUUID()}@example.invalid`;
  const user = await authService.register(email, 'Registro-gratuito-123', 'Free User');
  try {
    assert.equal(user.email, email);
    assert.equal(user.role, 'USER');
    assert.equal(user.status, 'ACTIVE');
    const schema = await readFile('prisma/schema.prisma', 'utf8');
    for (const model of ['Plan', 'UserPlan', 'CreditLedger', 'PaymentOrder', 'Payment']) {
      assert.doesNotMatch(schema, new RegExp(`model ${model}\\b`), `el schema no debe definir el modelo ${model}`);
    }
  } finally {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('el seed bootstrap no crea registros comerciales', async () => {
  const email = `seed-free-${randomUUID()}@example.invalid`;
  const result = await seedInitialData(prisma, { email, password: 'Admin-free-seguro-123' });
  assert.equal(result.adminSeeded, true);
  const admin = await prisma.user.findUniqueOrThrow({ where: { email } });
  try {
    assert.equal(admin.role, 'ADMIN');
    const seedSource = await readFile('backend/src/services/seedService.ts', 'utf8');
    assert.doesNotMatch(seedSource, /prisma\.(plan|userPlan|creditLedger|paymentOrder|payment)\b/);
  } finally {
    await prisma.session.deleteMany({ where: { userId: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
  }
});

test('las rutas de ejecución ya no importan el servicio legacy de créditos', async () => {
  const runtimeFiles = [
    'backend/src/services/conversionService.ts',
    'backend/src/services/mediaDownloadService.ts',
    'backend/src/workers/conversionWorker.ts',
    'backend/src/workers/mediaDownloadWorker.ts',
    'backend/src/controllers/conversionsController.ts',
  ];
  for (const relative of runtimeFiles) {
    const source = await readFile(relative, 'utf8');
    assert.doesNotMatch(source, /creditLedgerService/, `${relative} no debe usar el servicio legacy`);
    assert.match(source, /processingUsageService/, `${relative} debe usar processingUsageService`);
  }
});

test('el uso neutral se crea y se asienta en cancelación', async () => {
  const email = `cancel-usage-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({ data: { email, passwordHash: 'test-only', displayName: 'Cancel Usage' } });
  const jobId = `job-cancel-usage-${randomUUID()}`;
  try {
    const reserved = await processingUsageService.reserve(user.id, jobId, 'video-to-mp3', 1024, false);
    assert.equal(reserved.status, 'RESERVED');
    await processingUsageService.settle(jobId, 'CANCELLED');
    const usage = await prisma.processingUsage.findUniqueOrThrow({ where: { jobId } });
    assert.equal(usage.status, 'CANCELLED');
    assert.equal(usage.userId, user.id);
    assert.equal(usage.toolId, 'video-to-mp3');
    assert.equal(usage.inputBytes, BigInt(1024));
  } finally {
    await prisma.processingUsage.deleteMany({ where: { jobId } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('el estado del servicio sigue siendo público e independiente del uso', async () => {
  const response = await request(createBackendApp()).get('/api/status');
  assert.equal(response.status, 200);
  assert.ok(['OPERATIONAL', 'LIMITED', 'MAINTENANCE', 'UNAVAILABLE'].includes(response.body.data.state));
  const source = await readFile('backend/src/services/serviceStatusService.ts', 'utf8');
  assert.doesNotMatch(source, /processingUsage|creditLedger/);
});

test('las APIs legacy de créditos y pagos ya no están montadas', async () => {
  const app = createBackendApp();
  assert.equal((await request(app).post('/api/credits/estimate').send({ toolId: 'video-to-mp3', inputBytes: 1 })).status, 404);
  assert.equal((await request(app).get('/api/payments/config')).status, 404);
  assert.equal((await request(app).get('/api/payments/orders')).status, 404);
  assert.equal((await request(app).post('/api/payments/orders').send({ packageId: 'PLUS_BETA' })).status, 404);
});

test('la cuenta no expone campos comerciales legacy', async () => {
  const email = `account-free-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({ data: { email, passwordHash: 'test-only', displayName: 'Account Free' } });
  const session = await authService.createSession(user.id);
  try {
    const response = await request(createBackendApp()).get('/api/account').set('Cookie', `${SESSION_COOKIE}=${session.token}`);
    assert.equal(response.status, 200);
    const data = response.body.data;
    for (const forbidden of ['plan', 'credits', 'balance', 'ledger', 'payments', 'nextResetAt']) {
      assert.equal(Object.prototype.hasOwnProperty.call(data, forbidden), false, `la cuenta no debe exponer ${forbidden}`);
    }
    assert.equal(data.email, email);
    assert.ok(Array.isArray(data.jobs));
    assert.ok(Array.isArray(data.history));
    assert.ok(data.capabilities && typeof data.capabilities.effectiveMaxUploadSize === 'number');
  } finally {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test('el dashboard admin no expone métricas de créditos ni pagos', async () => {
  const email = `admin-dashboard-${randomUUID()}@example.invalid`;
  const admin = await prisma.user.create({ data: { email, passwordHash: 'test-only', role: 'ADMIN' } });
  const session = await authService.createSession(admin.id);
  try {
    const response = await request(createBackendApp()).get('/api/admin/dashboard').set('Cookie', `${SESSION_COOKIE}=${session.token}`);
    assert.equal(response.status, 200);
    const data = response.body.data;
    for (const forbidden of ['netCredits', 'payments']) {
      assert.equal(Object.prototype.hasOwnProperty.call(data, forbidden), false, `dashboard no debe exponer ${forbidden}`);
    }
    for (const required of ['users', 'activeUsers', 'jobs', 'pendingComplaints', 'newSuggestions']) {
      assert.equal(typeof data[required], 'number', `dashboard debe conservar ${required}`);
    }
  } finally {
    await prisma.session.deleteMany({ where: { userId: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
  }
});

test('admin ya no ofrece endpoints de créditos, planes ni pagos', async () => {
  const email = `admin-legacy-${randomUUID()}@example.invalid`;
  const admin = await prisma.user.create({ data: { email, passwordHash: 'test-only', role: 'ADMIN' } });
  const session = await authService.createSession(admin.id);
  const cookie = `${SESSION_COOKIE}=${session.token}`;
  try {
    const app = createBackendApp();
    const cases: Array<[string, string]> = [
      ['get', '/api/admin/plans'],
      ['patch', '/api/admin/plans/FREE'],
      ['get', '/api/admin/payments'],
      ['post', '/api/admin/payments/00000000-0000-0000-0000-000000000000/review'],
      ['patch', `/api/admin/users/${admin.id}/plan`],
      ['post', `/api/admin/users/${admin.id}/credits`],
    ];
    for (const [method, path] of cases) {
      const response = await (request(app) as any)[method](path).set('Cookie', cookie).set('X-CSRF-Token', session.csrf).send({});
      assert.equal(response.status, 404, `${method.toUpperCase()} ${path} debe estar retirado`);
    }
  } finally {
    await prisma.session.deleteMany({ where: { userId: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
  }
});

test('no queda código runtime importando servicios comerciales legacy', async () => {
  const retired = ['creditLedgerService', 'creditCostService', 'paymentService', 'paymentProvider', 'config/plans', 'config/betaPayments'];
  const files = [
    'backend/src/routes/account.routes.ts',
    'backend/src/routes/admin.routes.ts',
    'backend/src/routes/api.router.ts',
    'backend/src/services/conversionService.ts',
    'backend/src/services/mediaDownloadService.ts',
    'backend/src/workers/conversionWorker.ts',
    'backend/src/workers/mediaDownloadWorker.ts',
    'backend/src/controllers/conversionsController.ts',
    'backend/src/middleware/uploadHandler.ts',
  ];
  for (const relative of files) {
    const source = await readFile(relative, 'utf8');
    for (const symbol of retired) {
      assert.equal(source.includes(symbol), false, `${relative} no debe referenciar ${symbol}`);
    }
  }
});

test('los archivos backend legacy retirados ya no existen', async () => {
  const removed = [
    'backend/src/routes/credits.routes.ts',
    'backend/src/routes/payments.routes.ts',
    'backend/src/services/paymentService.ts',
    'backend/src/services/paymentProvider.ts',
    'backend/src/services/creditLedgerService.ts',
    'backend/src/services/creditCostService.ts',
    'backend/src/config/plans.ts',
    'backend/src/config/betaPayments.ts',
  ];
  for (const relative of removed) {
    await assert.rejects(() => readFile(relative, 'utf8'), `${relative} debe haberse retirado`);
  }
});

