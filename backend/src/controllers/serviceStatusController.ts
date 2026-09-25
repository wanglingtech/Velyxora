import { Request, Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { serviceStatusService } from '../services/serviceStatusService';
import {
  isServiceStatusState,
  isValidServiceStatusMessage,
  normalizeServiceStatusMessage,
} from '../config/serviceStatus';

const validationError = (res: Response, message: string) =>
  res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
  });

export async function getPublicServiceStatus(_req: Request, res: Response): Promise<void> {
  const status = await serviceStatusService.getPublicStatus();
  res.setHeader('Cache-Control', 'no-store');
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: { state: status.state, message: status.message },
  });
}

export async function getAdminServiceStatus(_req: Request, res: Response): Promise<void> {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: await serviceStatusService.getAdminStatus(),
  });
}

export async function updateServiceStatus(req: Request, res: Response): Promise<void> {
  const state = req.body?.state;
  const rawMessage = req.body?.message;

  if (!isServiceStatusState(state)) {
    validationError(res, 'Estado del servicio no válido.');
    return;
  }
  if (!isValidServiceStatusMessage(rawMessage)) {
    validationError(res, 'Mensaje público no válido o demasiado largo.');
    return;
  }

  try {
    const saved = await serviceStatusService.updateStatus(
      req.auth!.userId,
      state,
      normalizeServiceStatusMessage(rawMessage),
    );
    res.status(HTTP_STATUS.OK).json({ success: true, data: saved });
  } catch {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'SERVICE_STATUS_UPDATE_FAILED', message: 'No se pudo guardar el estado del servicio.' },
    });
  }
}
