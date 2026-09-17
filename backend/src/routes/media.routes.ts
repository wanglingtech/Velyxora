import { Router } from 'express';
import { analyzeMedia, processMedia } from '../controllers/mediaController';
import { requireProcessingAuth } from '../middleware/auth';
import { mediaAnalyzeLimit, mediaProcessLimit } from '../security/routeLimits';

const router = Router();
router.use(requireProcessingAuth);

router.post('/analyze', mediaAnalyzeLimit, analyzeMedia);
router.post('/process', mediaProcessLimit, processMedia);

export default router;
