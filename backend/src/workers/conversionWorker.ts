import path from 'path';
import { InMemoryQueue } from '../jobs/InMemoryQueue';
import { jobManager } from '../jobs/JobManager';
import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';
import { serverImageEngine } from '../engines/ServerImageEngine';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';
import fs from 'fs';
import { probeMedia } from '../utils/mediaProbe';
import { storageService } from '../services/storageService';

export const conversionQueue = new InMemoryQueue('conversions', 2);

conversionQueue.process(async (jobId: string, data: any) => {
  const job = jobManager.getJob(jobId);
  if (!job) return;

  jobManager.setStatus(jobId, 'PROCESSING');

  let outputPath: string | undefined;
  try {
    const inputExt = path.extname(job.input.path).replace(/^\./, '').toLowerCase();
    const targetFormat = (data.targetFormat || 'mp3').toLowerCase();
    const outputFilename = `converted-${jobId}-${path.parse(job.input.originalName).name}.${targetFormat}`;
    outputPath = path.join(ENV.STORAGE_DIR, outputFilename);

    let engine = null;

    if (serverFFmpegEngine.canHandle(inputExt, targetFormat)) {
      engine = serverFFmpegEngine;
    } else if (libreOfficeEngine.canHandle(inputExt, targetFormat)) {
      engine = libreOfficeEngine;
    } else if (serverImageEngine.canHandle(inputExt, targetFormat)) {
      engine = serverImageEngine;
    }

    if (!engine) {
      throw new Error(`No server engine registered to convert format '.${inputExt}' to '.${targetFormat}'`);
    }

    logger.info(`Processing job [${jobId}] with engine: ${engine.name}`);

    const result = await engine.convert(
      job.input.path,
      outputPath,
      data.options || {},
      (progress, message) => {
        jobManager.updateProgress(jobId, progress, message);
      },
      jobManager.getSignal(jobId),
    );

    if (jobManager.getJob(jobId)?.status === 'CANCELLED') {
      if (fs.existsSync(result.outputPath)) fs.unlinkSync(result.outputPath);
      return;
    }

    let probe;
    if (engine === serverFFmpegEngine) {
      probe = await probeMedia(result.outputPath);
      if (result.size <= 0 || probe.streams.length === 0) {
        throw new Error('FFPROBE_VALIDATION_FAILED: output has no valid media streams.');
      }
    }

    jobManager.updateJob(jobId, {
      metadata: probe ? { probe } : undefined,
      output: {
        fileId: path.parse(result.outputFilename).name,
        filename: result.outputFilename,
        mimeType: result.mimeType,
        size: result.size,
        path: result.outputPath,
        downloadUrl: `/api/download/${path.parse(result.outputFilename).name}`,
      },
    });

    storageService.registerOutput(result.outputPath, result.outputFilename, result.mimeType);

    jobManager.setStatus(jobId, 'COMPLETED');
  } catch (err: any) {
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (jobManager.getJob(jobId)?.status === 'CANCELLED') {
      logger.info(`Job [${jobId}] FFmpeg process cancelled and cleaned up.`);
    } else {
      logger.error(`Job [${jobId}] failed during execution: ${err.message}`);
      jobManager.setStatus(jobId, 'FAILED', err.message);
    }
  } finally {
    storageService.deleteFile(path.parse(job.input.filename).name);
  }
});
