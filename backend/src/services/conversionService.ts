import path from 'path';
import { storageService } from './storageService';
import { jobManager } from '../jobs/JobManager';
import { conversionQueue } from '../workers/conversionWorker';
import { ConversionRequestDto } from '../schemas/validation';
import { JobRecord } from '../types/jobs';
import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';
import { serverImageEngine } from '../engines/ServerImageEngine';

class ConversionService {
  async startConversion(dto: ConversionRequestDto): Promise<JobRecord> {
    // 1. Resolve source file
    let sourcePath = dto.sourceFilePath;
    let originalName = 'input-file';
    let mimeType = 'application/octet-stream';
    let size = 0;

    if (dto.fileId) {
      const stored = storageService.getFile(dto.fileId);
      if (!stored) {
        throw new Error(`File with id '${dto.fileId}' not found or has expired from temp storage.`);
      }
      sourcePath = stored.path;
      originalName = stored.originalName;
      mimeType = stored.mimeType;
      size = stored.size;
    }

    if (!sourcePath) {
      throw new Error('Either fileId or valid sourceFilePath is required to initiate conversion.');
    }

    const inputExt = path.extname(sourcePath).replace(/^\./, '').toLowerCase();
    const targetFormat = dto.targetFormat.toLowerCase();

    // 2. Validate engine support
    const canFfmpeg = serverFFmpegEngine.canHandle(inputExt, targetFormat);
    const canLibreOffice = libreOfficeEngine.canHandle(inputExt, targetFormat);
    const canImage = serverImageEngine.canHandle(inputExt, targetFormat);

    if (!canFfmpeg && !canLibreOffice && !canImage) {
      throw new Error(`Unsupported conversion route: '.${inputExt}' -> '.${targetFormat}'`);
    }

    // 3. Create Job
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const job = jobManager.createJob({
      id: jobId,
      toolId: dto.toolId,
      input: {
        fileId: dto.fileId,
        filename: path.basename(sourcePath),
        originalName,
        mimeType,
        size,
        path: sourcePath,
      },
      options: dto.options,
    });

    // 4. Queue for asynchronous worker execution
    await conversionQueue.add(jobId, {
      targetFormat: dto.targetFormat,
      options: dto.options,
    });

    return job;
  }
}

export const conversionService = new ConversionService();
