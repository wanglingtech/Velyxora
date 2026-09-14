import { Router } from 'express';
import {
  createConversion,
  getConversionStatus,
  cancelConversion,
} from '../controllers/conversionsController';
import { requireProcessingAuth } from '../middleware/auth';

const router = Router();
router.use(requireProcessingAuth);

router.post('/', createConversion);
router.get('/:id', getConversionStatus);
router.delete('/:id', cancelConversion);

export default router;
