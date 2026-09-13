import { Router } from 'express';
import healthRoutes from './health.routes';
import toolsRoutes from './tools.routes';
import formatsRoutes from './formats.routes';
import uploadsRoutes from './uploads.routes';
import conversionsRoutes from './conversions.routes';
import mediaRoutes from './media.routes';
import jobsRoutes from './jobs.routes';
import { streamDownload } from '../controllers/jobsController';

const router = Router();

router.use('/health', healthRoutes);
router.use('/tools', toolsRoutes);
router.use('/formats', formatsRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/conversions', conversionsRoutes);
router.use('/media', mediaRoutes);
router.use('/jobs', jobsRoutes);
router.get('/download/:fileId', streamDownload);

export default router;
