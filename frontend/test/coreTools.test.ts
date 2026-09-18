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
import { EMPTY_MEDIA_FORMATS_MESSAGE, canStartMediaAnalyze, completedMediaOutput, mediaAnalyzeErrorMessage, mediaFormatActionLabel, normalizeMediaAnalysis, selectInitialMediaFormat } from '../src/services/mediaService';
import { ApiError } from '../src/services/apiClient';

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

test('media downloader convierte AUTH_REQUIRED en un mensaje humano sin romper el render', () => {
  assert.equal(
    mediaAnalyzeErrorMessage(new ApiError('Inicia sesión.', 401, 'AUTH_REQUIRED')),
    'Tu sesión no está disponible. Inicia sesión nuevamente.',
  );
  assert.equal(mediaAnalyzeErrorMessage(new Error('Proveedor no compatible')), 'Proveedor no compatible');
});

test('media downloader no inicia otro análisis mientras analiza o procesa', () => {
  assert.equal(canStartMediaAnalyze(false, false), true);
  assert.equal(canStartMediaAnalyze(true, false), false);
  assert.equal(canStartMediaAnalyze(false, true), false);
});

test('media downloader conserva formatos parciales y clasifica video, audio y combined', () => {
  const metadata = normalizeMediaAnalysis({
    url: 'https://youtube.com/watch?v=test', platform: 'youtube', title: 'Test', author: 'Creator',
    formats: [
      { format_id: 'video-only', ext: 'mp4', vcodec: 'avc1', acodec: 'none', hasVideo: false, hasAudio: false },
      { id: 'audio-only', container: 'm4a', vcodec: 'none', acodec: 'mp4a', hasVideo: false, hasAudio: false },
      { formatId: 'combined', extension: 'webm', vcodec: 'vp9', acodec: 'opus', hasVideo: true, hasAudio: true },
    ],
    isDirectDownloadPossible: true, requiresExternalExtractor: true,
  }, 'YouTube');
  assert.equal(metadata.availableFormats.length, 3);
  assert.deepEqual(metadata.availableFormats.map((format) => [format.id, format.type, format.hasVideo, format.hasAudio]), [
    ['video-only', 'video', true, false],
    ['audio-only', 'audio', false, true],
    ['combined', 'video', true, true],
  ]);
  assert.equal(selectInitialMediaFormat(metadata)?.id, 'video-only');
});

test('media downloader conserva estado explícito cuando analyze no devuelve formatos', () => {
  const metadata = normalizeMediaAnalysis({
    url: 'https://youtube.com/watch?v=empty', platform: 'youtube', title: 'Empty', author: 'Creator', formats: [],
    isDirectDownloadPossible: false, requiresExternalExtractor: true,
  }, 'YouTube');
  assert.equal(metadata.availableFormats.length, 0);
  assert.equal(selectInitialMediaFormat(metadata), null);
  assert.equal(EMPTY_MEDIA_FORMATS_MESSAGE, 'No se encontraron formatos compatibles para este contenido.');
});

test('media downloader termina inmediatamente si COMPLETED no contiene output', () => {
  assert.throws(
    () => completedMediaOutput({ id: 'job', toolId: 'media-downloader', status: 'COMPLETED', progress: 100 }),
    /sin un archivo de salida válido/,
  );
  assert.equal(completedMediaOutput({ id: 'job', toolId: 'media-downloader', status: 'PROCESSING', progress: 50 }), null);
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
