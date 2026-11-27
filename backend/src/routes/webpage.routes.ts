import { Router } from 'express';
import {
  captureWebpage,
  snapshotWebpage,
  webpageAsset,
  webpageCapabilities,
} from '../controllers/webpageController';
import { requireProcessingAuth } from '../middleware/auth';
import { webpageAssetLimit, webpageCaptureLimit, webpageSnapshotLimit } from '../security/routeLimits';

const router = Router();
router.use(requireProcessingAuth);

router.get('/capabilities', webpageSnapshotLimit, webpageCapabilities);
router.post('/snapshot', webpageSnapshotLimit, snapshotWebpage);
router.post('/capture', webpageCaptureLimit, captureWebpage);
router.get('/asset', webpageAssetLimit, webpageAsset);

export default router;
