import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_TOOL_REGISTRY,
  TOOLKIT_GROUPS,
  PLANNED_TOOL_REGISTRY,
  getToolById,
  getToolsForGroup,
  getPlannedToolsForGroup,
} from '../src/registry/tools';
import { routeFromPath } from '../src/services/appRouting';

test('cada herramienta pública pertenece exactamente a un grupo del toolkit', () => {
  for (const tool of PUBLIC_TOOL_REGISTRY) {
    const groups = TOOLKIT_GROUPS.filter((group) =>
      getToolsForGroup(group.id).some((match) => match.id === tool.id),
    );
    assert.equal(groups.length, 1, `Grupo ambiguo o ausente para ${tool.id}: ${groups.map((g) => g.id).join(',')}`);
  }
});

test('Multimedia, Converters y Dev Tools reparten las herramientas esperadas', () => {
  const multimedia = getToolsForGroup('multimedia').map((tool) => tool.id);
  const converters = getToolsForGroup('converters').map((tool) => tool.id);
  const devTools = getToolsForGroup('dev-tools').map((tool) => tool.id);
  const utilities = getToolsForGroup('utilities').map((tool) => tool.id);

  assert.ok(multimedia.includes('video-to-mp3'), 'video-to-mp3 debe estar en Multimedia');
  assert.ok(converters.includes('csv-to-json'), 'csv-to-json debe estar en Converters');
  assert.ok(converters.includes('unit-converter'), 'unit-converter debe estar en Converters');
  assert.equal(devTools.includes('json-formatter'), true, 'json-formatter debe estar en Dev Tools');
  assert.equal(devTools.includes('csv-to-json'), false, 'csv-to-json no debe duplicarse en Dev Tools');
  assert.equal(utilities.includes('unit-converter'), false, 'unit-converter no debe duplicarse en Utilities');
});

test('las herramientas planificadas no son públicas, no tienen runner ni endpoint', () => {
  const publicIds = new Set(PUBLIC_TOOL_REGISTRY.map((tool) => tool.id));
  for (const planned of PLANNED_TOOL_REGISTRY) {
    assert.equal(publicIds.has(planned.id), false, `${planned.id} no debe ser pública`);
    assert.equal(getToolById(planned.id), undefined, `${planned.id} no debe resolverse a una herramienta real`);
  }
  assert.deepEqual(getPlannedToolsForGroup('whatsapp'), [], 'WhatsApp Tools ya no debe tener entradas planificadas');
  assert.deepEqual(getPlannedToolsForGroup('all'), [], 'El catálogo completo no mezcla planificadas');
});

test('la ruta /support resuelve la vista de apoyo', () => {
  assert.deepEqual(routeFromPath('/support'), { view: 'support' });
});
