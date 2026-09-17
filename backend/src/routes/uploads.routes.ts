import { Router } from 'express';
import { uploadFile } from '../controllers/uploadsController';
import { prepareUpload, uploadSingle } from '../middleware/uploadHandler';
import { requireProcessingAuth } from '../middleware/auth';
import { uploadLimit } from '../security/routeLimits';

const router = Router();
router.use(requireProcessingAuth);
router.post('/', uploadLimit, prepareUpload, uploadSingle, uploadFile);

export default router;
