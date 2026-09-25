import { Request, Response } from 'express';
import { HTTP_STATUS } from '../config/constants';
import { collectHealth } from '../services/healthService';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.status(HTTP_STATUS.OK).json(await collectHealth());
}
