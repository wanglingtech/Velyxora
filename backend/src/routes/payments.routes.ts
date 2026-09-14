import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { paymentService } from '../services/paymentService';
import { BETA_PACKAGES } from '../config/betaPayments';
const router = Router(); router.use(requireAuth);
router.get('/config', (_req, res) => res.json({ success: true, data: { mode: 'BETA_MANUAL', enabled: process.env.BETA_MANUAL_PAYMENTS === 'true', provider: 'Yape', displayName: process.env.YAPE_DISPLAY_NAME || '', phone: process.env.YAPE_PHONE || '', packages: BETA_PACKAGES } }));
router.post('/orders', async (req, res) => { try { const order = await paymentService.createOrder(req.auth!.userId, { ...req.body, idempotencyKey: req.header('idempotency-key') || '' }); res.status(201).json({ success: true, data: order }); } catch (e: any) { res.status(400).json({ success: false, error: { code: 'ORDER_FAILED', message: e.message } }); } });
router.post('/orders/:id/reference', async (req, res) => { try { res.json({ success: true, data: await paymentService.submitReference(req.auth!.userId, req.params.id, String(req.body.reference || '')) }); } catch (e: any) { res.status(400).json({ success: false, error: { code: 'REFERENCE_FAILED', message: e.message } }); } });
export default router;
