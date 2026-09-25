import multer from 'multer';
import fs from 'fs';
import { ENV } from '../config/env';
import { FREE_SERVICE_LIMITS } from '../config/freeServiceLimits';
import { sanitizeFilename } from '../utils/sanitize';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getUploadPolicy, validateUploadMetadata } from '../security/uploadPolicy';
import { storageService } from '../services/storageService';

export const effectiveUploadLimit = (
  planLimit: number,
  isAdmin: boolean,
  hardLimit: number,
  nodeEnv: string,
  localAdminHardLimit: number,
) => isAdmin
  ? (nodeEnv === 'production' ? hardLimit : localAdminHardLimit)
  : Math.min(planLimit, hardLimit);

// Ensure temp dir exists
if (!fs.existsSync(ENV.TEMP_DIR)) {
  fs.mkdirSync(ENV.TEMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ENV.TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const cleanName = sanitizeFilename(file.originalname);
    const uniquePrefix = randomUUID();
    cb(null, `${uniquePrefix}-${cleanName}`);
  },
});

export async function prepareUpload(req: Request, res: Response, next: NextFunction) {
  const toolId = typeof req.query.toolId === 'string' ? req.query.toolId : '';
  if (!getUploadPolicy(toolId)) { res.status(400).json({ success: false, error: { code: 'INVALID_TOOL', message: 'Selecciona una herramienta de archivo válida.' } }); return; }
  if (process.env.NODE_ENV === 'test') { req.uploadContext = { toolId, effectiveLimit: ENV.MAX_UPLOAD_SIZE_BYTES, planCode: 'FREE', maxConcurrentJobs: FREE_SERVICE_LIMITS.maxConcurrentServerJobs, commercialBypass: true }; next(); return; }
  // Authentication is already enforced by requireProcessingAuth. Server
  // execution is free: no active UserPlan or credit balance is required.
  const commercialBypass = req.auth!.role === 'ADMIN';
  const effectiveLimit = effectiveUploadLimit(FREE_SERVICE_LIMITS.maxUploadSizeBytes, commercialBypass, ENV.MAX_UPLOAD_SIZE_BYTES, ENV.NODE_ENV, ENV.LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES);
  const pendingLimit = FREE_SERVICE_LIMITS.pendingFileLimit + (commercialBypass ? 1 : 0);
  if (storageService.countFilesForOwner(req.auth!.userId) >= pendingLimit) { res.status(429).json({ success: false, error: { code: 'PENDING_UPLOAD_LIMIT', message: 'Ya tienes varios archivos pendientes. Espera a que termine uno.' } }); return; }
  req.uploadContext = { toolId, effectiveLimit, planCode: 'FREE', maxConcurrentJobs: commercialBypass ? FREE_SERVICE_LIMITS.adminMaxConcurrentServerJobs : FREE_SERVICE_LIMITS.maxConcurrentServerJobs, commercialBypass };
  next();
}

export function uploadSingle(req: Request, res: Response, next: NextFunction) {
  const limit = req.uploadContext?.effectiveLimit || ENV.MAX_UPLOAD_SIZE_BYTES;
  multer({ storage, limits: { fileSize: limit, files: 1 }, fileFilter: (_req, file, cb) => {
    const result = validateUploadMetadata(req.uploadContext!.toolId, file.originalname, file.mimetype);
    if ('message' in result) { cb(new Error(result.message)); return; }
    cb(null, true);
  } }).single('file')(req, res, next);
}
