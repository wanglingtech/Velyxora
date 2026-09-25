import { Router } from 'express';
import { getPublicServiceStatus } from '../controllers/serviceStatusController';

const router = Router();

// Public product operational status. Read-only, no authentication, and
// separate from /api/health (component health).
router.get('/', getPublicServiceStatus);

export default router;
