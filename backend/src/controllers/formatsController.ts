import { Request, Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { serverFFmpegEngine } from '../engines/ServerFFmpegEngine';
import { libreOfficeEngine } from '../engines/LibreOfficeEngine';
import { serverImageEngine } from '../engines/ServerImageEngine';

export async function getFormats(req: Request, res: Response): Promise<void> {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: {
      engines: [
        {
          name: serverFFmpegEngine.name,
          inputs: serverFFmpegEngine.supportedInputFormats,
          outputs: serverFFmpegEngine.supportedOutputFormats,
          available: await serverFFmpegEngine.isAvailable(),
        },
        {
          name: libreOfficeEngine.name,
          inputs: libreOfficeEngine.supportedInputFormats,
          outputs: libreOfficeEngine.supportedOutputFormats,
          available: await libreOfficeEngine.isAvailable(),
        },
        {
          name: serverImageEngine.name,
          inputs: serverImageEngine.supportedInputFormats,
          outputs: serverImageEngine.supportedOutputFormats,
          available: await serverImageEngine.isAvailable(),
        },
      ],
    },
    timestamp: new Date().toISOString(),
  });
}
