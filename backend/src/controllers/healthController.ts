import { Request, Response } from 'express';
import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';
import { HTTP_STATUS } from '../config/constants';
import fs from 'fs';
import { ENV } from '../config/env';
import { isFfprobeAvailable } from '../utils/mediaProbe';

export async function getHealth(req: Request, res: Response): Promise<void> {
  const [ffmpegReady, ffprobeReady, libreofficeReady] = await Promise.all([
    serverFFmpegEngine.isAvailable(),
    isFfprobeAvailable(),
    libreOfficeEngine.isAvailable(),
  ]);

  const storageReady = fs.existsSync(ENV.TEMP_DIR) && fs.existsSync(ENV.STORAGE_DIR);

  const mem = process.memoryUsage();
  const uptime = process.uptime();

  res.status(HTTP_STATUS.OK).json({
    status: 'ok',
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
      libreoffice: libreofficeReady,
      storage: storageReady,
    },
    timestamp: new Date().toISOString(),
  });
}
