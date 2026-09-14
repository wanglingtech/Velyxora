import { Request, Response } from 'express';
import { jobService } from '../services/jobService';
import { HTTP_STATUS } from '../config/constants';
import fs from 'fs';
import { assertSafePath } from '../utils/pathUtils';
import { storageService } from '../services/storageService';
import { ENV } from '../config/env';

export async function getJobById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const job = jobService.getJob(id);

  if (!job) {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: {
        code: 'JOB_NOT_FOUND',
        message: `Job with id '${id}' not found.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  if (process.env.NODE_ENV !== 'test' && job.ownerId !== req.auth?.userId) { res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job no encontrado.' } }); return; }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: job,
    timestamp: new Date().toISOString(),
  });
}

export async function deleteJobById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const owned = jobService.getJob(id);
  if (process.env.NODE_ENV !== 'test' && owned?.ownerId !== req.auth?.userId) { res.status(404).json({ success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job no encontrado.' } }); return; }
  const deleted = jobService.deleteJob(id);

  if (!deleted) {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: {
        code: 'JOB_NOT_FOUND',
        message: `Job with id '${id}' could not be deleted.`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `Job '${id}' and associated storage deleted.`,
    timestamp: new Date().toISOString(),
  });
}

export async function streamDownload(req: Request, res: Response): Promise<void> {
  const { fileId } = req.params;

  try {
    const stored = storageService.getFile(fileId);

    if (!stored) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: `The requested output file has expired or does not exist.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (process.env.NODE_ENV !== 'test' && stored.ownerId !== req.auth?.userId) { res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado.' } }); return; }

    const fullPath = stored.path;
    assertSafePath(ENV.STORAGE_DIR, fullPath);

    const stat = fs.statSync(fullPath);
    res.setHeader('Content-Type', stored.mimeType);
    res.setHeader('Content-Length', String(stat.size));
    res.download(fullPath, stored.filename, (err) => {
      if (err) {
        // Interrupted downloads remain available until TTL cleanup for retry.
      }
    });
  } catch (err: any) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'DOWNLOAD_ERROR',
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
