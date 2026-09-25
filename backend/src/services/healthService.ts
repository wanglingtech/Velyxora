import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';
import { ENV } from '../config/env';
import { isFfprobeAvailable } from '../utils/mediaProbe';
import { ytDlpService } from '../services/ytDlpService';
import { prisma } from '../db/prisma';
import fs from 'fs';

export interface HealthPayload {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  memoryUsageMb: { rss: number; heapTotal: number; heapUsed: number };
  services: {
    ffmpeg: boolean;
    ffprobe: boolean;
    libreOffice: boolean;
    storage: boolean;
    ytDlp: boolean;
    database: boolean;
  };
  diagnostics: { ytDlpVersion: string | null };
  timestamp: string;
}

/**
 * Single source of truth for the real component-health snapshot. Consumed by
 * both `/api/health` and the product operational-status fallback. This does not
 * change `/api/health` semantics; it is the same detection, extracted.
 */
export async function collectHealth(): Promise<HealthPayload> {
  const [ffmpegReady, ffprobeReady, libreofficeReady, ytDlpVersion, databaseReady] = await Promise.all([
    serverFFmpegEngine.isAvailable(),
    isFfprobeAvailable(),
    libreOfficeEngine.isAvailable(),
    ytDlpService.getVersion(),
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
  ]);

  const storageReady = fs.existsSync(ENV.TEMP_DIR) && fs.existsSync(ENV.STORAGE_DIR);

  const mem = process.memoryUsage();
  const uptime = process.uptime();

  const requiredReady = storageReady && databaseReady;
  return {
    status: requiredReady ? 'ok' : 'degraded',
    version: '1.0.0',
    uptimeSeconds: Math.floor(uptime),
    memoryUsageMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
    services: {
      ffmpeg: ffmpegReady,
      ffprobe: ffprobeReady,
      libreOffice: libreofficeReady,
      storage: storageReady,
      ytDlp: Boolean(ytDlpVersion),
      database: databaseReady,
    },
    diagnostics: { ytDlpVersion },
    timestamp: new Date().toISOString(),
  };
}
