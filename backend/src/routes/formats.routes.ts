import { Router } from 'express';
import { getFormats } from '../controllers/formatsController';

const router = Router();
router.get('/', getFormats);

export default router;
