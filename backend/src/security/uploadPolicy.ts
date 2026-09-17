import fs from 'node:fs';
import path from 'node:path';

type Policy = { extensions: string[]; mimes: string[]; label: string };
const video = { extensions: ['mp4','webm','mov'], mimes: ['video/mp4','video/webm','video/quicktime'], label: 'archivos MP4, WEBM o MOV' };
const audio = { extensions: ['mp3','wav','flac','ogg'], mimes: ['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/flac','audio/ogg'], label: 'archivos MP3, WAV, FLAC u OGG' };
const policies: Record<string, Policy> = {
  'video-to-mp3': video, 'video-to-wav': video, 'video-to-gif': video, 'video-trimmer': video,
  'video-mute': video, 'video-speed': video, 'video-resize': video, 'video-compressor': video,
  'mp4-to-webm': { ...video, extensions: ['mp4'], mimes: ['video/mp4'], label: 'archivos MP4' },
  'webm-to-mp4': { ...video, extensions: ['webm'], mimes: ['video/webm'], label: 'archivos WEBM' },
  'video-metadata-inspector': video,
  'wav-to-mp3': { ...audio, extensions: ['wav'], mimes: ['audio/wav','audio/x-wav'], label: 'archivos WAV' },
  'mp3-to-wav': { ...audio, extensions: ['mp3'], mimes: ['audio/mpeg','audio/mp3'], label: 'archivos MP3' },
  'audio-bitrate': audio, 'audio-normalize': audio, 'audio-format-converter': audio,
  'word-to-pdf': { extensions: ['docx'], mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream','application/zip','application/x-zip-compressed'], label: 'archivos DOCX' },
  'xlsx-to-pdf': { extensions: ['xlsx'], mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream','application/zip','application/x-zip-compressed'], label: 'archivos XLSX' },
  'pptx-to-pdf': { extensions: ['pptx'], mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation','application/octet-stream','application/zip','application/x-zip-compressed'], label: 'archivos PPTX' },
  'odt-to-pdf': { extensions: ['odt'], mimes: ['application/vnd.oasis.opendocument.text','application/octet-stream','application/zip'], label: 'archivos ODT' },
  'ods-to-pdf': { extensions: ['ods'], mimes: ['application/vnd.oasis.opendocument.spreadsheet','application/octet-stream','application/zip'], label: 'archivos ODS' },
  'odp-to-pdf': { extensions: ['odp'], mimes: ['application/vnd.oasis.opendocument.presentation','application/octet-stream','application/zip'], label: 'archivos ODP' },
};

export function getUploadPolicy(toolId: string): Policy | undefined { return policies[toolId]; }
export function validateUploadMetadata(toolId: string, filename: string, mime: string): { valid: true } | { valid: false; message: string } {
  const policy = policies[toolId];
  if (!policy) return { valid: false, message: 'Esta herramienta no admite uploads en el servidor.' };
  const extension = path.extname(filename).slice(1).toLowerCase();
  if (!policy.extensions.includes(extension) || !policy.mimes.includes(mime.toLowerCase())) return { valid: false, message: `Esta herramienta admite ${policy.label}.` };
  return { valid: true };
}

export function hasExpectedSignature(toolId: string, filePath: string): boolean {
  const policy = policies[toolId]; if (!policy) return false;
  const fd = fs.openSync(filePath, 'r'); const head = Buffer.alloc(16); const read = fs.readSync(fd, head, 0, head.length, 0); fs.closeSync(fd);
  const value = head.subarray(0, read); const ext = policy.extensions;
  if (ext.some((x) => ['docx','xlsx','pptx','odt','ods','odp'].includes(x))) return value[0] === 0x50 && value[1] === 0x4b;
  if (ext.includes('mp4') || ext.includes('mov')) { if (value.subarray(4, 8).toString('ascii') === 'ftyp') return true; }
  if (ext.includes('webm') && value.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))) return true;
  if (ext.includes('wav') && value.subarray(0,4).toString('ascii') === 'RIFF' && value.subarray(8,12).toString('ascii') === 'WAVE') return true;
  if (ext.includes('flac') && value.subarray(0,4).toString('ascii') === 'fLaC') return true;
  if (ext.includes('ogg') && value.subarray(0,4).toString('ascii') === 'OggS') return true;
  if (ext.includes('mp3') && (value.subarray(0,3).toString('ascii') === 'ID3' || (value[0] === 0xff && (value[1] & 0xe0) === 0xe0))) return true;
  return false;
}
