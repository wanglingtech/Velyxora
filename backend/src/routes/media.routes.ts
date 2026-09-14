import { Router } from 'express';
import { analyzeMedia, processMedia } from '../controllers/mediaController';
import { requireProcessingAuth } from '../middleware/auth';

const router = Router();
router.use(requireProcessingAuth);

router.post('/analyze', analyzeMedia);
router.post('/process', processMedia);

export default router;
