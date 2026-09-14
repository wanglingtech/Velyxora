import { Router } from 'express';
import { uploadFile } from '../controllers/uploadsController';
import { upload } from '../middleware/uploadHandler';
import { requireProcessingAuth } from '../middleware/auth';

const router = Router();
router.use(requireProcessingAuth);
router.post('/', upload.single('file'), uploadFile);

export default router;
