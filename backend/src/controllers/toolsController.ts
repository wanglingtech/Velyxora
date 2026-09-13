import { Request, Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';

export async function getTools(req: Request, res: Response): Promise<void> {
  const [ffmpegAvailable, libreofficeAvailable] = await Promise.all([
    serverFFmpegEngine.isAvailable(),
    libreOfficeEngine.isAvailable(),
  ]);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      capabilities: {
        serverFFmpeg: ffmpegAvailable,
        serverLibreOffice: libreofficeAvailable,
        clientSideEngines: ['browser-canvas', 'browser-webaudio', 'browser-crypto', 'browser-text', 'browser-qrcode'],
      },
      message: 'Tool definitions and backend capabilities retrieved successfully.',
    },
    timestamp: new Date().toISOString(),
  });
}
