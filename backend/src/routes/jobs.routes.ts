import { Router } from 'express';
import { getJobById, deleteJobById, streamDownload } from '../controllers/jobsController';

const router = Router();

router.get('/:id', getJobById);
router.delete('/:id', deleteJobById);

export default router;
