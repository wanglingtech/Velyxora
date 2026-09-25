import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createBackendApp } from '../src/app';
import {
  deriveServiceStatusState,
  isServiceStatusState,
  isValidServiceStatusMessage,
  normalizeServiceStatusMessage,
  resolveServiceStatusState,
  SERVICE_STATUS_MESSAGE_MAX_LENGTH,
  SERVICE_STATUS_STATES,
} from '../src/config/serviceStatus';
import { prisma } from '../src/db/prisma';
import { authService, SESSION_COOKIE } from '../src/services/authService';
import { ServiceStatusService, serviceStatusService } from '../src/services/serviceStatusService';
import {
  getPublicServiceStatus,
  getAdminServiceStatus,
  updateServiceStatus,
} from '../src/controllers/serviceStatusController';

const healthy = (overrides: Partial<{ ffmpeg: boolean; ffprobe: boolean; libreOffice: boolean; storage: boolean; ytDlp: boolean; database: boolean }> = {}, status: 'ok' | 'degraded' | 'error' = 'ok') => ({
  status,
  services: { ffmpeg: true, ffprobe: true, libreOffice: true, storage: true, ytDlp: true, database: true, ...overrides },
});

const stub = (object: any, key: string, implementation: any) => {
  const original = object[key];
  object[key] = implementation;
  return () => { object[key] = original; };
};

const fakeRes = () => {
  const state: any = { headers: {}, code: 200 };
  return {
    state,
    setHeader(key: string, value: string) { state.headers[key] = value; },
    status(code: number) { state.code = code; return this; },
    json(body: any) { state.body = body; return this; },
  };
};

test('la allowlist de estados acepta solo los cuatro estados de producto', () => {
  assert.deepEqual([...SERVICE_STATUS_STATES], ['OPERATIONAL', 'LIMITED', 'MAINTENANCE', 'UNAVAILABLE']);
  for (const state of SERVICE_STATUS_STATES) assert.equal(isServiceStatusState(state), true);
  for (const invalid of ['ok', 'ERROR', 'free', '', undefined, null, 1, {}]) assert.equal(isServiceStatusState(invalid), false);
});

test('el mensaje público se recorta y se acota, y las cadenas vacías se vuelven null', () => {
  assert.equal(normalizeServiceStatusMessage('  mantenimiento  '), 'mantenimiento');
  assert.equal(normalizeServiceStatusMessage('   '), null);
  assert.equal(normalizeServiceStatusMessage(''), null);
  assert.equal(normalizeServiceStatusMessage(undefined), null);
  assert.equal(normalizeServiceStatusMessage(123 as any), null);
  assert.equal(isValidServiceStatusMessage('Mantenimiento temporal'), true);
  assert.equal(isValidServiceStatusMessage(''), true);
  assert.equal(isValidServiceStatusMessage('x'.repeat(SERVICE_STATUS_MESSAGE_MAX_LENGTH)), true);
  assert.equal(isValidServiceStatusMessage('x'.repeat(SERVICE_STATUS_MESSAGE_MAX_LENGTH + 1)), false);
  assert.equal(isValidServiceStatusMessage('<script>alert(1)</script>'), false);
  assert.equal(isValidServiceStatusMessage('javascript:alert(1)'), false);
  assert.equal(isValidServiceStatusMessage({} as any), false);
});

test('la señal derivada de la salud nunca inventa mantenimiento', () => {
  assert.equal(deriveServiceStatusState(null), 'UNAVAILABLE');
  assert.equal(deriveServiceStatusState(healthy({}, 'error')), 'UNAVAILABLE');
  assert.equal(deriveServiceStatusState(healthy({ database: false })), 'UNAVAILABLE');
  assert.equal(deriveServiceStatusState(healthy({ storage: false })), 'UNAVAILABLE');
  assert.equal(deriveServiceStatusState(healthy({}, 'degraded')), 'LIMITED');
  assert.equal(deriveServiceStatusState(healthy({ ffmpeg: false })), 'LIMITED');
  assert.equal(deriveServiceStatusState(healthy({ libreOffice: false })), 'LIMITED');
  assert.equal(deriveServiceStatusState(healthy({ ytDlp: false })), 'LIMITED');
  assert.equal(deriveServiceStatusState(healthy()), 'OPERATIONAL');
  for (const snapshot of [null, healthy({ ffmpeg: false }), healthy({}, 'degraded')]) {
    assert.notEqual(deriveServiceStatusState(snapshot), 'MAINTENANCE');
  }
});

test('un estado explícito persiste sobre la salud derivada', () => {
  assert.equal(resolveServiceStatusState('MAINTENANCE', healthy()), 'MAINTENANCE');
  assert.equal(resolveServiceStatusState('UNAVAILABLE', healthy()), 'UNAVAILABLE');
  assert.equal(resolveServiceStatusState(null, healthy()), 'OPERATIONAL');
  assert.equal(resolveServiceStatusState(undefined, null), 'UNAVAILABLE');
});

test('sin registro, getPublicStatus cae al estado derivado de la salud', async () => {
  const service = new ServiceStatusService(async () => healthy({ ffmpeg: false }));
  const restore = stub(service as any, 'readPersisted', async () => null);
  try {
    assert.deepEqual(await service.getPublicStatus(), { state: 'LIMITED', message: null });
  } finally {
    restore();
  }
});

test('un registro persistido prevalece en getPublicStatus', async () => {
  const service = new ServiceStatusService(async () => healthy());
  const restore = stub(service as any, 'readPersisted', async () => ({ state: 'MAINTENANCE', message: 'Mantenimiento programado', updatedAt: new Date() }));
  try {
    assert.deepEqual(await service.getPublicStatus(), { state: 'MAINTENANCE', message: 'Mantenimiento programado' });
  } finally {
    restore();
  }
});

test('updateStatus usa la clave singleton y normaliza el mensaje', async () => {
  let captured: any;
  const restore = stub(prisma, '$transaction', async (callback: any) => callback({
    serviceStatus: {
      upsert: async (args: any) => {
        captured = args;
        return { state: args.create.state, message: args.create.message, updatedAt: new Date('2026-01-01T00:00:00.000Z') };
      },
    },
    adminAuditLog: { create: async () => ({ id: 'audit-1' }) },
  }));
  try {
    const saved = await serviceStatusService.updateStatus('admin-1', 'LIMITED', '  Mensaje  ');
    assert.equal(captured.where.singleton, 'current');
    assert.equal(captured.create.singleton, 'current');
    assert.equal(captured.update.singleton, undefined);
    assert.equal(captured.create.message, 'Mensaje');
    assert.equal(saved.state, 'LIMITED');
    assert.equal(saved.message, 'Mensaje');
  } finally {
    restore();
  }
});

test('el endpoint público expone solo state y message sin datos administrativos', async () => {
  const restore = stub(serviceStatusService as any, 'getPublicStatus', async () => ({ state: 'MAINTENANCE', message: 'Mantenimiento programado' }));
  const res = fakeRes();
  try {
    await getPublicServiceStatus({} as any, res as any);
    assert.equal(res.state.code, 200);
    assert.equal(res.state.headers['Cache-Control'], 'no-store');
    assert.deepEqual(Object.keys(res.state.body.data).sort(), ['message', 'state']);
    assert.equal(res.state.body.data.state, 'MAINTENANCE');
    assert.equal(JSON.stringify(res.state.body).includes('admin'), false);
  } finally {
    restore();
  }
});

test('el estado de administración informa persisted y updatedAt solo al admin', async () => {
  const restore = stub(serviceStatusService as any, 'getAdminStatus', async () => ({ state: 'LIMITED', message: null, persisted: true, updatedAt: null }));
  const res = fakeRes();
  try {
    await getAdminServiceStatus({} as any, res as any);
    assert.equal(res.state.body.success, true);
    assert.equal(res.state.body.data.state, 'LIMITED');
    assert.equal(res.state.body.data.persisted, true);
  } finally {
    restore();
  }
});

test('updateServiceStatus rechaza estados y mensajes inválidos antes de persistir', async () => {
  let calls = 0;
  const restore = stub(serviceStatusService as any, 'updateStatus', async () => { calls += 1; return { state: 'LIMITED', message: null, updatedAt: null }; });
  try {
    const invalidState = fakeRes();
    await updateServiceStatus({ body: { state: 'FREE' }, auth: { userId: 'a' } } as any, invalidState as any);
    assert.equal(invalidState.state.code, 400);
    assert.equal(invalidState.state.body.error.code, 'VALIDATION_ERROR');

    const longMessage = fakeRes();
    await updateServiceStatus({ body: { state: 'LIMITED', message: 'x'.repeat(SERVICE_STATUS_MESSAGE_MAX_LENGTH + 1) }, auth: { userId: 'a' } } as any, longMessage as any);
    assert.equal(longMessage.state.code, 400);

    const markup = fakeRes();
    await updateServiceStatus({ body: { state: 'LIMITED', message: '<b>x</b>' }, auth: { userId: 'a' } } as any, markup as any);
    assert.equal(markup.state.code, 400);

    assert.equal(calls, 0);
  } finally {
    restore();
  }
});

test('updateServiceStatus valida y persiste un estado admitido', async () => {
  let received: any;
  const restore = stub(serviceStatusService as any, 'updateStatus', async (adminId: string, state: string, message: string | null) => {
    received = { adminId, state, message };
    return { state, message, updatedAt: null };
  });
  const res = fakeRes();
  try {
    await updateServiceStatus({ body: { state: 'MAINTENANCE', message: '  Estamos realizando mantenimiento.  ' }, auth: { userId: 'admin-1' } } as any, res as any);
    assert.equal(res.state.code, 200);
    assert.deepEqual(received, { adminId: 'admin-1', state: 'MAINTENANCE', message: 'Estamos realizando mantenimiento.' });
  } finally {
    restore();
  }
});

test('autorización del endpoint admin: anónimo 401, usuario 403, admin 200', async () => {
  const adminSession = { id: 'session-admin', user: { id: 'admin-1', role: 'ADMIN', email: 'admin@example.invalid' }, csrfHash: 'h', csrfToken: 't' };
  const userSession = { id: 'session-user', user: { id: 'user-1', role: 'USER', email: 'user@example.invalid' }, csrfHash: 'h', csrfToken: 't' };
  const restoreResolve = stub(authService as any, 'resolveDetailed', async (token?: string) => {
    if (token === 'admin-token') return { status: 'AUTHENTICATED', session: adminSession };
    if (token === 'user-token') return { status: 'AUTHENTICATED', session: userSession };
    return { status: 'MISSING_COOKIE', session: null };
  });
  const restoreCsrf = stub(authService as any, 'verifyCsrf', () => true);
  const restoreUpdate = stub(serviceStatusService as any, 'updateStatus', async (_adminId: string, state: string, message: string | null) => ({ state, message, updatedAt: null }));
  const restoreGet = stub(serviceStatusService as any, 'getAdminStatus', async () => ({ state: 'OPERATIONAL', message: null, persisted: false, updatedAt: null }));
  try {
    const app = createBackendApp();
    const anonymous = await request(app).put('/api/admin/service-status').send({ state: 'LIMITED', message: '' });
    assert.equal(anonymous.status, 401);

    const normalUser = await request(app)
      .put('/api/admin/service-status')
      .set('Cookie', `${SESSION_COOKIE}=user-token`)
      .send({ state: 'LIMITED', message: '' });
    assert.equal(normalUser.status, 403);

    const admin = await request(app)
      .put('/api/admin/service-status')
      .set('Cookie', `${SESSION_COOKIE}=admin-token`)
      .send({ state: 'LIMITED', message: 'Mantenimiento corto' });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.state, 'LIMITED');

    // GET is not a mutation and needs no CSRF token, but still requires ADMIN.
    const anonGet = await request(app).get('/api/admin/service-status');
    assert.equal(anonGet.status, 401);
    const userGet = await request(app).get('/api/admin/service-status').set('Cookie', `${SESSION_COOKIE}=user-token`);
    assert.equal(userGet.status, 403);
    const adminGet = await request(app).get('/api/admin/service-status').set('Cookie', `${SESSION_COOKIE}=admin-token`);
    assert.equal(adminGet.status, 200);
  } finally {
    restoreGet();
    restoreUpdate();
    restoreCsrf();
    restoreResolve();
  }
});

test('GET /api/status responde 200 sin autenticación y sin registro persistido', async () => {
  const response = await request(createBackendApp()).get('/api/status');
  assert.equal(response.status, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(Object.keys(response.body.data).sort(), ['message', 'state']);
  assert.equal(isServiceStatusState(response.body.data.state), true);
});
