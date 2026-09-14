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
  for (const model of ['User','Session','Plan','UserPlan','CreditLedger','ProcessingUsage','PaymentOrder','Payment','AdminAuditLog']) assert.match(schema, new RegExp(`model ${model}`));
  assert.match(migration, /idempotencyKey.*UNIQUE/); assert.match(schema, /ADMIN_TEST/);
});
