import multer from 'multer';
import fs from 'fs';
import { ENV } from '../config/env';
import { sanitizeFilename } from '../utils/sanitize';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma';
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
  if (process.env.NODE_ENV === 'test') { req.uploadContext = { toolId, effectiveLimit: ENV.MAX_UPLOAD_SIZE_BYTES, planCode: 'TEST', maxConcurrentJobs: 4, commercialBypass: true }; next(); return; }
  const active = await prisma.userPlan.findFirst({ where: { userId: req.auth!.userId, active: true }, include: { plan: true } });
  if (!active) { res.status(403).json({ success: false, error: { code: 'PLAN_REQUIRED', message: 'Tu cuenta no tiene un plan activo.' } }); return; }
  const commercialBypass = req.auth!.role === 'ADMIN';
  const effectiveLimit = effectiveUploadLimit(active.plan.maxUploadSize, commercialBypass, ENV.MAX_UPLOAD_SIZE_BYTES, ENV.NODE_ENV, ENV.LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES);
  const pendingLimit = Math.max(2, active.plan.maxConcurrentJobs + 1);
  if (storageService.countFilesForOwner(req.auth!.userId) >= pendingLimit) { res.status(429).json({ success: false, error: { code: 'PENDING_UPLOAD_LIMIT', message: 'Ya tienes varios archivos pendientes. Espera a que termine uno.' } }); return; }
  req.uploadContext = { toolId, effectiveLimit, planCode: active.plan.code, maxConcurrentJobs: active.plan.maxConcurrentJobs, commercialBypass };
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
