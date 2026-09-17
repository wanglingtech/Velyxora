import { ToolDefinition } from '../types';

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed']);

export function getToolAcceptAttribute(tool: ToolDefinition): string {
  const extensions = (tool.acceptedExtensions || []).map((extension) => `.${extension.toLowerCase()}`);
  return [...new Set([...extensions, ...(tool.acceptedMimeTypes || tool.inputTypes)])].join(',');
}

export function getHumanFileFormats(tool: ToolDefinition): string[] {
  const extensions = (tool.acceptedExtensions || []).map((extension) => extension.replace(/^\./, '').toUpperCase());
  if (extensions.length) return [...new Set(extensions)];
  const labels = (tool.acceptedMimeTypes || tool.inputTypes).map((mime) => {
    if (mime === '*/*') return 'ARCHIVO';
    if (mime.endsWith('/*')) return mime.split('/')[0].toUpperCase();
    const subtype = mime.split('/')[1] || mime;
    return ({ jpeg: 'JPG', 'svg+xml': 'SVG', plain: 'TXT', 'x-zip-compressed': 'ZIP' } as Record<string,string>)[subtype] || subtype.split(/[.+-]/).pop()!.toUpperCase();
  });
  return [...new Set(labels)];
}

export function validateFileForTool(tool: ToolDefinition, file: Pick<File, 'name' | 'type'>): { valid: true } | { valid: false; message: string } {
  const extensions = (tool.acceptedExtensions || []).map((extension) => extension.toLowerCase());
  if (!extensions.length) return { valid: true };
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (!extensions.includes(extension)) return { valid: false, message: `Selecciona un archivo ${extensions.map((value) => `.${value.toUpperCase()}`).join(' o ')} válido.` };

  const acceptedMimes = (tool.acceptedMimeTypes || tool.inputTypes).map((mime) => mime.toLowerCase());
  const mime = (file.type || '').toLowerCase();
  if (mime && !GENERIC_MIME_TYPES.has(mime) && !acceptedMimes.includes(mime)) {
    return { valid: false, message: `El tipo del archivo no corresponde a ${extensions.map((value) => `.${value.toUpperCase()}`).join(' o ')}.` };
  }
  return { valid: true };
}
