import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppLink,
  encodeWhatsAppMessage,
  isSafeWhatsAppLink,
  normalizeWhatsAppPhone,
  validateWhatsAppMessage,
} from '../src/services/whatsappService';
import {
  PLANNED_TOOL_REGISTRY,
  PUBLIC_TOOL_REGISTRY,
  getToolById,
  getToolRunnerKind,
  getToolsForGroup,
} from '../src/registry/tools';

const WHATSAPP_IDS = ['whatsapp-link-generator', 'whatsapp-message-builder', 'whatsapp-qr-generator'];

test('normaliza teléfonos internacionales sin inventar código de país', () => {
  const formatted = normalizeWhatsAppPhone('+51 968 555 200');
  assert.deepEqual(formatted, { ok: true, digits: '51968555200', e164: '+51968555200' });

  const bare = normalizeWhatsAppPhone('51968555200');
  assert.deepEqual(bare, { ok: true, digits: '51968555200', e164: '+51968555200' });

  const punctuation = normalizeWhatsAppPhone('(51) 968-555-200');
  assert.deepEqual(punctuation, { ok: true, digits: '51968555200', e164: '+51968555200' });

  // Local number: accepted as-is, never prefixed with a country code.
  const local = normalizeWhatsAppPhone('968 555 200');
  assert.deepEqual(local, { ok: true, digits: '968555200', e164: '+968555200' });
});

test('rechaza entradas inválidas de teléfono', () => {
  for (const invalid of ['', '   ', '123', '1234567890123456', 'abc1234567', '+51 968 555 200 ext 3', '00 51 968 555 200']) {
    const result = normalizeWhatsAppPhone(invalid);
    assert.equal(result.ok, false, `debió rechazar: "${invalid}"`);
  }
});

test('codifica mensajes correctamente', () => {
  assert.equal(encodeWhatsAppMessage('Hola mundo & más'), 'Hola%20mundo%20%26%20m%C3%A1s');
  assert.equal(validateWhatsAppMessage('hola'), null);
  assert.notEqual(validateWhatsAppMessage('a'.repeat(5000)), null);
});

test('genera enlaces wa.me válidos y seguros', () => {
  assert.equal(buildWhatsAppLink('+51 968 555 200'), 'https://wa.me/51968555200');
  assert.equal(
    buildWhatsAppLink('+51 968 555 200', 'Hola mundo & más'),
    'https://wa.me/51968555200?text=Hola%20mundo%20%26%20m%C3%A1s',
  );
  assert.equal(buildWhatsAppLink('+51 968 555 200', '   '), 'https://wa.me/51968555200');
  assert.throws(() => buildWhatsAppLink('abc'), /número|caracteres/i);
  assert.throws(() => buildWhatsAppLink('+51968555200', 'a'.repeat(4097)), /superar/i);

  assert.equal(isSafeWhatsAppLink('https://wa.me/51968555200'), true);
  assert.equal(isSafeWhatsAppLink('javascript:alert(1)'), false);
  assert.equal(isSafeWhatsAppLink('https://example.com'), false);
});

test('las herramientas de WhatsApp son públicas, cliente y del runner whatsapp', () => {
  const publicIds = new Set(PUBLIC_TOOL_REGISTRY.map((tool) => tool.id));
  const groupIds = new Set(getToolsForGroup('whatsapp').map((tool) => tool.id));
  const plannedIds = new Set(PLANNED_TOOL_REGISTRY.map((tool) => tool.id));

  for (const id of WHATSAPP_IDS) {
    const tool = getToolById(id);
    assert.ok(tool, `${id} debe existir en el registro público`);
    assert.equal(publicIds.has(id), true, `${id} debe ser pública`);
    assert.equal(groupIds.has(id), true, `${id} debe pertenecer al grupo WhatsApp Tools`);
    assert.equal(plannedIds.has(id), false, `${id} no debe seguir como planificada`);
    assert.equal(tool!.category, 'whatsapp', `${id} debe usar la categoría whatsapp`);
    assert.equal(tool!.processingMode, 'CLIENT_SIDE', `${id} debe ser CLIENT_SIDE`);
    assert.equal(Boolean(tool!.requiresServer), false, `${id} no debe requerir backend`);
    assert.equal(getToolRunnerKind(tool!), 'whatsapp', `${id} debe resolver al runner whatsapp`);
  }
});
