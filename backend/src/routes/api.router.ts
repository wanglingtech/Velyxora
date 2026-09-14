import { Router } from 'express';
import healthRoutes from './health.routes';
import toolsRoutes from './tools.routes';
import formatsRoutes from './formats.routes';
import uploadsRoutes from './uploads.routes';
import conversionsRoutes from './conversions.routes';
import mediaRoutes from './media.routes';
import jobsRoutes from './jobs.routes';
import { streamDownload } from '../controllers/jobsController';
import { requireProcessingAuth } from '../middleware/auth';
import authRoutes from './auth.routes';
import creditsRoutes from './credits.routes';
import accountRoutes from './account.routes';
import paymentsRoutes from './payments.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/credits', creditsRoutes);
router.use('/account', accountRoutes);
router.use('/payments', paymentsRoutes);
router.use('/admin', adminRoutes);
router.use('/tools', toolsRoutes);
router.use('/formats', formatsRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/conversions', conversionsRoutes);
router.use('/media', mediaRoutes);
router.use('/jobs', jobsRoutes);
router.get('/download/:fileId', requireProcessingAuth, streamDownload);

export default router;
