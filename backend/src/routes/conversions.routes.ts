import { Router } from 'express';
import {
  createConversion,
  getConversionStatus,
  cancelConversion,
} from '../controllers/conversionsController';

const router = Router();

router.post('/', createConversion);
router.get('/:id', getConversionStatus);
router.delete('/:id', cancelConversion);

export default router;
