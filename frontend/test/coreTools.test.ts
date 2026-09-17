import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCode128B } from '../src/services/barcodeEngine';
import {
  computeTextDiff,
  csvToJson,
  jsonToCsv,
  markdownToHtml,
  parseColorToAll,
} from '../src/services/dataConverterService';
import { generateQrCode } from '../src/services/conversionEngine';
import { mediaFormatActionLabel } from '../src/services/mediaService';

test('conversores de datos producen salidas reales y rechazan JSON inválido', () => {
  assert.deepEqual(csvToJson('name,age\n"Ada",37').json, [{ name: 'Ada', age: 37 }]);
  assert.equal(jsonToCsv([{ name: 'Ada, Lovelace', active: true }]), 'name,active\n"Ada, Lovelace",true');
  assert.throws(() => jsonToCsv('42'), /array de objetos/);
});

test('markdown, color y diff cubren resultado válido y entrada inválida', () => {
  const html = markdownToHtml('# Título\n\n<script>alert(1)</script>');
  assert.match(html, /<h1/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(markdownToHtml('[x](javascript:alert(1))'), /href="javascript:/i);
  assert.doesNotMatch(markdownToHtml('[x](" onmouseover="alert(1))'), /onmouseover=/i);
  assert.equal(parseColorToAll('#ff0000')?.hex, '#FF0000');
  assert.equal(parseColorToAll('no-es-un-color'), null);
  assert.deepEqual(computeTextDiff('a\nb', 'a\nc').map((line) => line.type), ['unchanged', 'removed', 'added']);
});

test('media downloader renderiza un estado válido cuando aún no hay formato seleccionado', () => {
  assert.equal(mediaFormatActionLabel(null), 'Selecciona un formato');
  assert.equal(mediaFormatActionLabel({ id: 'audio', extension: 'mp3', formatNote: 'Audio MP3' }), 'Descargar Audio MP3');
  assert.equal(mediaFormatActionLabel({ id: 'fallback', extension: 'webm' }), 'Descargar WEBM');
});

test('Code 128B codifica ASCII y rechaza caracteres fuera del alfabeto', () => {
  const codes = encodeCode128B('VELYXORA-123');
  assert.equal(codes[0], 104);
  assert.equal(codes.at(-1), 106);
  assert.throws(() => encodeCode128B('emoji-😀'), /no soportado/);
});

test('QR genera un PNG descargable real', async () => {
  const result = await generateQrCode('https://velyxora.example/test', { width: 128 });
  assert.match(result.dataUrl, /^data:image\/png;base64,/);
  assert.equal(result.blob.type, 'image/png');
  assert.ok(result.blob.size > 100);
});
