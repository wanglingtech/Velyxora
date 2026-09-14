import test from 'node:test';
import assert from 'node:assert/strict';
import { getToolById } from '../src/registry/tools';
import { getToolAcceptAttribute, validateFileForTool } from '../src/services/fileValidation';

const tool = (id: string) => {
  const result = getToolById(id);
  assert.ok(result);
  return result;
};

test('Office usa extensiones estructuradas, no nombres conceptuales', () => {
  assert.match(getToolAcceptAttribute(tool('word-to-pdf')), /\.docx/);
  assert.equal(getToolAcceptAttribute(tool('word-to-pdf')).split(',')[0], '.docx');
  assert.equal(validateFileForTool(tool('word-to-pdf'), { name: 'FICHA DE APLICACIÓN 12(1).docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).valid, true);
  assert.equal(validateFileForTool(tool('xlsx-to-pdf'), { name: 'datos.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }).valid, true);
  assert.equal(validateFileForTool(tool('pptx-to-pdf'), { name: 'slides.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }).valid, true);
});

test('Office acepta MIME vacío/genérico solo cuando la extensión coincide', () => {
  assert.equal(validateFileForTool(tool('word-to-pdf'), { name: 'document.docx', type: '' }).valid, true);
  assert.equal(validateFileForTool(tool('word-to-pdf'), { name: 'document.docx', type: 'application/octet-stream' }).valid, true);
  assert.equal(validateFileForTool(tool('word-to-pdf'), { name: 'document.docx', type: 'text/plain' }).valid, false);
});

test('Office rechaza extensiones cruzadas y muestra el formato real', () => {
  const txt = validateFileForTool(tool('word-to-pdf'), { name: 'document.txt', type: 'text/plain' });
  assert.equal(txt.valid, false);
  if (!txt.valid) { assert.match(txt.message, /\.DOCX/); assert.doesNotMatch(txt.message, /\.WORD/); }
  assert.equal(validateFileForTool(tool('xlsx-to-pdf'), { name: 'document.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).valid, false);
});
