import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathForView, routeFromPath } from '../src/services/appRouting';

test('rutas SPA directas resuelven vistas y short links', () => {
  assert.deepEqual(routeFromPath('/login'), { view: 'auth', authMode: 'login' });
  assert.deepEqual(routeFromPath('/register'), { view: 'auth', authMode: 'register' });
  assert.deepEqual(routeFromPath('/account'), { view: 'account' });
  assert.deepEqual(routeFromPath('/admin'), { view: 'admin' });
  assert.deepEqual(routeFromPath('/s/s1p1UNU'), { view: 'short-link', param: 's1p1UNU' });
  assert.deepEqual(routeFromPath('/missing-page'), { view: 'not-found' });
  assert.equal(pathForView('tool', 'url-shortener'), '/tools/url-shortener');
});

test('Vercel sirve archivos existentes antes del fallback SPA', async () => {
  const config = JSON.parse(await readFile('frontend/vercel.json', 'utf8'));
  assert.equal(config.routes[0].continue, true);
  assert.deepEqual(config.routes[1], { handle: 'filesystem' });
  assert.deepEqual(config.routes[2], { src: '/.*', dest: '/index.html' });
});

test('refrescos de cuenta y admin usan API sin recargar la SPA', async () => {
  const source = await readFile('frontend/src/components/views/AccountViews.tsx', 'utf8');
  assert.match(source, /["']Recargar["']/);
  assert.match(source, /disabled=\{refreshing\}/);
  assert.doesNotMatch(source, /window\.location\.reload/);
  for (const call of ['adminDashboard()', 'adminUsers()', 'adminComplaints()', 'adminSuggestions()', 'account()']) assert.ok(source.includes(call), call);
});
