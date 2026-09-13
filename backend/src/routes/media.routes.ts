import { Router } from 'express';
import { analyzeMedia, processMedia } from '../controllers/mediaController';

const router = Router();

router.post('/analyze', analyzeMedia);
router.post('/process', processMedia);

export default router;
