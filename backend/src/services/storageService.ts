import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
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
  ownerId?: string;
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

  public registerFile(file: Express.Multer.File, ownerId?: string): StoredFileInfo {
    // IDs are API identifiers, not filenames. Keeping them independent avoids
    // otherwise-safe characters in user filenames (dots, spaces, Unicode)
    // being rejected by the conversion request schema.
    const fileId = `file-${randomUUID()}`;
    const record: StoredFileInfo = {
      fileId,
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimeType: file.mimetype,
      createdAt: Date.now(),
      ownerId,
    };

    this.files.set(fileId, record);
    return record;
  }

  public registerOutput(outputPath: string, originalName: string, mimeType: string, ownerId?: string): StoredFileInfo {
    assertSafePath(ENV.STORAGE_DIR, outputPath);
    const stat = fs.statSync(outputPath);
    const filename = path.basename(outputPath);
    const record: StoredFileInfo = {
      fileId: `file-${randomUUID()}`,
      originalName,
      filename,
      path: outputPath,
      size: stat.size,
      mimeType,
      createdAt: Date.now(),
      ownerId,
    };
    this.files.set(record.fileId, record);
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
      const root = path.dirname(record.path) === path.resolve(ENV.STORAGE_DIR)
        ? ENV.STORAGE_DIR : ENV.TEMP_DIR;
      assertSafePath(root, record.path);
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
