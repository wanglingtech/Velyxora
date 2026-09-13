import { Request, Response } from 'express';
import { jobService } from '../services/jobService';
import { HTTP_STATUS } from '../config/constants';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env';
import { assertSafePath } from '../utils/pathUtils';

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

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: job,
    timestamp: new Date().toISOString(),
  });
}

export async function deleteJobById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
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

  // Search for matching file in storage directory
  try {
    const files = fs.readdirSync(ENV.STORAGE_DIR);
    const target = files.find((f) => f.includes(fileId));

    if (!target) {
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

    const fullPath = path.join(ENV.STORAGE_DIR, target);
    assertSafePath(ENV.STORAGE_DIR, fullPath);

    res.download(fullPath, target, (err) => {
      if (err) {
        // stream was closed or aborted
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
