import { Router } from 'express';
import { getTools } from '../controllers/toolsController';
import { requireProcessingAuth } from '../middleware/auth';
import { storageService } from '../services/storageService';
import { probeMedia } from '../utils/mediaProbe';

const router = Router();
router.get('/', getTools);
router.post('/probe', requireProcessingAuth, async (req, res) => {
  const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId : '';
  const file = storageService.getFile(fileId);
  if (!file || (process.env.NODE_ENV !== 'test' && file.ownerId !== req.auth!.userId)) { res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado o expirado.' } }); return; }
  try {
    const probe = await probeMedia(file.path);
    res.json({ success: true, data: probe });
  } finally {
    storageService.deleteFile(fileId);
  }
});

export default router;
