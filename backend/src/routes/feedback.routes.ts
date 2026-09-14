import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middleware/auth';
import { authService, SESSION_COOKIE } from '../services/authService';

const router = Router();
const submitLimit = rateLimit({ windowMs: 15 * 60_000, limit: process.env.NODE_ENV === 'production' ? 5 : 30, standardHeaders: true, legacyHeaders: false });
const clean = (value: unknown, min: number, max: number, label: string) => {
  const text = String(value || '').trim();
  if (text.length < min || text.length > max) throw new Error(`${label} debe tener entre ${min} y ${max} caracteres.`);
  if (/<[^>]*>|javascript:/i.test(text)) throw new Error(`${label} contiene contenido no permitido.`);
  return text;
};
const email = (value: unknown) => { const text = clean(value, 5, 254, 'El email').toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new Error('Email inválido.'); return text; };
const suspicious = (text: string) => /(https?:\/\/.*){3,}|\b(?:spam|casino|viagra)\b/i.test(text);

router.post('/complaints', submitLimit, async (req, res) => {
  try {
    if (!['RECLAMO', 'QUEJA'].includes(req.body.type)) throw new Error('Tipo de solicitud inválido.');
    const detail = clean(req.body.detail, 20, 4000, 'El detalle');
    const session = await authService.resolve(req.cookies?.[SESSION_COOKIE]);
    const complaint = await prisma.complaint.create({ data: { trackingCode: `VX-${randomBytes(6).toString('hex').toUpperCase()}`, userId: session?.userId, claimantName: clean(req.body.claimantName, 2, 100, 'El nombre'), email: email(req.body.email), type: req.body.type, subject: clean(req.body.subject, 3, 160, 'El asunto'), detail, flagged: suspicious(detail) } });
    res.status(201).json({ success: true, data: { id: complaint.id, trackingCode: complaint.trackingCode, status: complaint.status, createdAt: complaint.createdAt } });
  } catch (error: any) { res.status(400).json({ success: false, error: { code: 'COMPLAINT_INVALID', message: error.message } }); }
});
router.get('/complaints/mine', requireAuth, async (req, res) => res.json({ success: true, data: await prisma.complaint.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: 50 }) }));
router.post('/suggestions', submitLimit, requireAuth, async (req, res) => {
  try { if (!['MEJORA','NUEVA_FUNCION','PROBLEMA_UX','OTRO'].includes(req.body.category)) throw new Error('Categoría inválida.'); const item = await prisma.suggestion.create({ data: { userId: req.auth!.userId, category: req.body.category, title: clean(req.body.title, 3, 120, 'El título'), description: clean(req.body.description, 10, 2500, 'La descripción') } }); res.status(201).json({ success: true, data: item }); }
  catch (error: any) { res.status(400).json({ success: false, error: { code: 'SUGGESTION_INVALID', message: error.message } }); }
});
router.get('/suggestions/mine', requireAuth, async (req, res) => res.json({ success: true, data: await prisma.suggestion.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: 50 }) }));
export default router;
