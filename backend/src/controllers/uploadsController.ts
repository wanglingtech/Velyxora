import { Request, Response } from 'express';
import { storageService } from '../services/storageService';
import { HTTP_STATUS } from '../config/constants';
import { ENV } from '../config/env';
import fs from 'node:fs';
import { hasExpectedSignature } from '../security/uploadPolicy';

export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'FILE_MISSING',
        message: 'No file was provided in the multipart request body under field name "file".',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!hasExpectedSignature(req.uploadContext!.toolId, req.file.path)) {
    try { fs.unlinkSync(req.file.path); } catch { /* best effort */ }
    res.status(415).json({ success: false, error: { code: 'INVALID_FORMAT', message: 'El contenido del archivo no coincide con el formato esperado para esta herramienta.' } }); return;
  }

  const stored = storageService.registerFile(req.file, req.auth?.userId, req.uploadContext?.toolId);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: {
      fileId: stored.fileId,
      filename: stored.filename,
      originalName: stored.originalName,
      size: stored.size,
      mimeType: stored.mimeType,
      expiresInMinutes: Math.floor(ENV.TEMP_FILE_TTL_MS / 60_000),
    },
    timestamp: new Date().toISOString(),
  });
}
