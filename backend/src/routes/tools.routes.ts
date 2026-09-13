import { Router } from 'express';
import { getTools } from '../controllers/toolsController';

const router = Router();
router.get('/', getTools);

export default router;
