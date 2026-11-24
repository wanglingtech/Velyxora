import { Router } from 'express';
import { snapshotWebpage, webpageAsset } from '../controllers/webpageController';
import { requireProcessingAuth } from '../middleware/auth';
import { webpageAssetLimit, webpageSnapshotLimit } from '../security/routeLimits';

const router = Router();
router.use(requireProcessingAuth);

router.post('/snapshot', webpageSnapshotLimit, snapshotWebpage);
router.get('/asset', webpageAssetLimit, webpageAsset);

export default router;
