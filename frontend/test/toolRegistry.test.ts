import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES_CONFIG, PUBLIC_TOOL_REGISTRY, getToolById, getToolRunnerKind, searchTools } from '../src/registry/tools';

test('todas las herramientas públicas tienen metadata, categoría, ruta y runner', () => {
  const categories = new Set(CATEGORIES_CONFIG.map((category) => category.id));
  const ids = new Set<string>();
  for (const tool of PUBLIC_TOOL_REGISTRY) {
    assert.ok(tool.id && tool.slug && tool.name && tool.description && tool.icon);
    assert.equal(ids.has(tool.id), false, `ID duplicado: ${tool.id}`); ids.add(tool.id);
    assert.ok(categories.has(tool.category as never), `Categoría inválida: ${tool.id}`);
    assert.ok(tool.inputTypes.length && tool.outputTypes.length && tool.keywords.length, `Metadata incompleta: ${tool.id}`);
    assert.equal(getToolById(tool.slug)?.id, tool.id, `Ruta no resoluble: ${tool.id}`);
    assert.ok(getToolRunnerKind(tool), `Sin runner: ${tool.id}`);
    assert.ok(searchTools(tool.name).some((match) => match.id === tool.id), `No searchable: ${tool.id}`);
  }
});

test('búsqueda cubre formatos y aliases sin duplicados', () => {
  const cases: Array<[string, string]> = [['word docx pdf','word-to-pdf'],['excel xlsx','xlsx-to-pdf'],['powerpoint pptx','pptx-to-pdf'],['mp3 video','video-to-mp3'],['json','json-formatter']];
  for (const [query, id] of cases) {
    const results = searchTools(query);
    assert.ok(results.some((tool) => tool.id === id), `${query} no encontró ${id}`);
    assert.equal(new Set(results.map((tool) => tool.id)).size, results.length);
  }
});
