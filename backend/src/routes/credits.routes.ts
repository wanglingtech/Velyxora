import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { creditLedgerService } from '../services/creditLedgerService';
const router = Router();
router.use(requireAuth);
router.post('/estimate', async (req, res) => {
  const inputBytes = Number(req.body.inputBytes || 0);
  if (!req.body.toolId || !Number.isSafeInteger(inputBytes) || inputBytes < 0) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'toolId/inputBytes inválidos.' } }); return; }
  res.json({ success: true, data: await creditLedgerService.estimate(req.auth!.userId, req.body.toolId, inputBytes, req.body.options || {}) });
});
export default router;
