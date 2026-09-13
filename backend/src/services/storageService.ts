import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';
import { assertSafePath } from '../utils/pathUtils';

export interface StoredFileInfo {
  fileId: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: number;
}

class StorageService {
  private files = new Map<string, StoredFileInfo>();

  constructor() {
    this.ensureDirectories();
    this.startTtlCleanup();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(ENV.STORAGE_DIR)) {
      fs.mkdirSync(ENV.STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(ENV.TEMP_DIR)) {
      fs.mkdirSync(ENV.TEMP_DIR, { recursive: true });
    }
  }

  public registerFile(file: Express.Multer.File): StoredFileInfo {
    const fileId = path.parse(file.filename).name;
    const record: StoredFileInfo = {
      fileId,
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
      createdAt: Date.now(),
    };

    this.files.set(fileId, record);
    return record;
  }

  public getFile(fileId: string): StoredFileInfo | undefined {
    const record = this.files.get(fileId);
    if (!record) return undefined;
    if (!fs.existsSync(record.path)) {
      this.files.delete(fileId);
      return undefined;
    }
    return record;
  }

  public deleteFile(fileId: string): boolean {
    const record = this.files.get(fileId);
    if (!record) return false;

    try {
      assertSafePath(ENV.TEMP_DIR, record.path);
      if (fs.existsSync(record.path)) {
        fs.unlinkSync(record.path);
      }
    } catch (err: any) {
      logger.warn(`Failed to unlink file ${record.path}: ${err.message}`);
    }

    this.files.delete(fileId);
    return true;
  }

  private startTtlCleanup(): void {
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [fileId, record] of this.files.entries()) {
        if (now - record.createdAt > ENV.TEMP_FILE_TTL_MS) {
          logger.info(`TTL expired for fileId: ${fileId}. Removing.`);
          this.deleteFile(fileId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    if (timer.unref) {
      timer.unref();
    }
  }
}

export const storageService = new StorageService();
