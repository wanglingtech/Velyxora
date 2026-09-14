import { Request, Response } from 'express';
import { storageService } from '../services/storageService';
import { HTTP_STATUS } from '../config/constants';

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

  const stored = storageService.registerFile(req.file, req.auth?.userId);

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    data: {
      fileId: stored.fileId,
      filename: stored.filename,
      originalName: stored.originalName,
      size: stored.size,
      mimeType: stored.mimeType,
      expiresInMinutes: 30,
    },
    timestamp: new Date().toISOString(),
  });
}
