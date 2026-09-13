import { Router } from 'express';
import { uploadFile } from '../controllers/uploadsController';
import { upload } from '../middleware/uploadHandler';

const router = Router();
router.post('/', upload.single('file'), uploadFile);

export default router;
