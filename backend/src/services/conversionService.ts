import path from 'path';
import { storageService } from './storageService';
import { jobManager } from '../jobs/JobManager';
import { conversionQueue } from '../workers/conversionWorker';
import { ConversionRequestDto } from '../schemas/validation';
import { JobRecord } from '../types/jobs';
import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';
import { serverImageEngine } from '../engines/ServerImageEngine';
import { creditLedgerService } from './creditLedgerService';

class ConversionService {
  async startConversion(dto: ConversionRequestDto, billing?: { userId: string; isAdmin: boolean }): Promise<JobRecord> {
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
      if (billing && stored.ownerId !== billing.userId) throw new Error('El archivo no pertenece al usuario autenticado.');
      if (stored.toolId && stored.toolId !== dto.toolId) throw new Error('El archivo fue validado para una herramienta diferente.');
    }

    if (!sourcePath) {
      throw new Error('Either fileId or valid sourceFilePath is required to initiate conversion.');
    }

    const inputExt = path.extname(sourcePath).replace(/^\./, '').toLowerCase();
    const targetFormat = dto.targetFormat.toLowerCase();

    const officeMimes: Record<string, string[]> = {
      docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'],
      xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'],
      pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed'],
      odt: ['application/vnd.oasis.opendocument.text', 'application/octet-stream'],
      ods: ['application/vnd.oasis.opendocument.spreadsheet', 'application/octet-stream'],
      odp: ['application/vnd.oasis.opendocument.presentation', 'application/octet-stream'],
    };
    if (officeMimes[inputExt] && !officeMimes[inputExt].includes(mimeType)) {
      throw new Error('El tipo MIME no coincide con la extensión del documento.');
    }

    // 2. Validate engine support
    const canFfmpeg = serverFFmpegEngine.canHandle(inputExt, targetFormat);
    const canLibreOffice = libreOfficeEngine.canHandle(inputExt, targetFormat);
    const canImage = serverImageEngine.canHandle(inputExt, targetFormat);

    if (!canFfmpeg && !canLibreOffice && !canImage) {
      throw new Error(`Unsupported conversion route: '.${inputExt}' -> '.${targetFormat}'`);
    }

    // 3. Create Job
    const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    if (billing) {
      try { await creditLedgerService.reserve(billing.userId, jobId, dto.toolId, size, billing.isAdmin, dto.options); }
      catch (error) { if (dto.fileId) storageService.deleteFile(dto.fileId); throw error; }
    }

    const job = jobManager.createJob({
      id: jobId,
      ownerId: billing?.userId,
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
      billingUserId: billing?.userId,
    });

    return job;
  }
}

export const conversionService = new ConversionService();
