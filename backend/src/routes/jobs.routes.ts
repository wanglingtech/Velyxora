import { Router } from 'express';
import { getJobById, deleteJobById, streamDownload } from '../controllers/jobsController';
import { requireProcessingAuth } from '../middleware/auth';

const router = Router();
router.use(requireProcessingAuth);

router.get('/:id', getJobById);
router.delete('/:id', deleteJobById);

export default router;
