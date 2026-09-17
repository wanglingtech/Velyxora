import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db/prisma';
import { authService, SESSION_COOKIE } from '../services/authService';
import { resolveShortLink, validateShortLinkTarget } from '../services/shortLinkService';
import { shortLinkCreateLimit, shortLinkReportLimit, shortLinkResolveLimit } from '../security/routeLimits';

const router = Router();

router.post('/', shortLinkCreateLimit, async (req, res) => {
  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const safe = validateShortLinkTarget(rawUrl);
  if (!safe.valid) { res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'Introduce una URL http:// o https:// válida.' } }); return; }
  const session = await authService.resolve(req.cookies?.[SESSION_COOKIE]);
  if (session && !authService.verifyCsrf(session, req.header('x-csrf-token'))) { res.status(403).json({ success: false, error: { code: 'CSRF_INVALID', message: 'Token CSRF inválido.' } }); return; }
  const expiresInDays = Number(req.body?.expiresInDays || 30);
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) { res.status(400).json({ success: false, error: { code: 'INVALID_EXPIRY', message: 'La expiración debe estar entre 1 y 365 días.' } }); return; }
  let link = null;
  for (let attempt = 0; attempt < 4 && !link; attempt += 1) {
    const slug = crypto.randomBytes(12).toString('base64url');
    try { link = await prisma.shortLink.create({ data: { slug, targetUrl: safe.targetUrl, userId: session?.user.id, expiresAt: new Date(Date.now() + expiresInDays * 86400000) } }); }
    catch (error: any) { if (error?.code !== 'P2002') throw error; }
  }
  if (!link) { res.status(503).json({ success: false, error: { code: 'SLUG_UNAVAILABLE', message: 'No se pudo crear el enlace. Inténtalo otra vez.' } }); return; }
  res.status(201).json({ success: true, data: { slug: link.slug, shortPath: `/s/${link.slug}`, targetUrl: link.targetUrl, expiresAt: link.expiresAt } });
});

router.get('/:slug', shortLinkResolveLimit, async (req, res) => {
  const result = await resolveShortLink(req.params.slug);
  if (result.status === 'NOT_FOUND') { res.status(404).json({ success: false, error: { code: 'SHORT_LINK_NOT_FOUND', message: 'Este enlace no existe.' } }); return; }
  if (result.status === 'EXPIRED') { res.status(410).json({ success: false, error: { code: 'SHORT_LINK_EXPIRED', message: 'Este enlace expiró.' } }); return; }
  if (result.status === 'DISABLED') { res.status(410).json({ success: false, error: { code: 'SHORT_LINK_DISABLED', message: 'Este enlace ha sido deshabilitado.' } }); return; }
  if (result.status === 'UNSAFE') { res.status(422).json({ success: false, error: { code: 'SHORT_LINK_UNSAFE', message: 'El destino almacenado no es seguro.' } }); return; }
  res.json({ success: true, data: { targetUrl: result.targetUrl, expiresAt: result.expiresAt } });
});

router.post('/:slug/reports', shortLinkReportLimit, async (req, res) => {
  const category = String(req.body?.category || '');
  const detail = typeof req.body?.detail === 'string' ? req.body.detail.trim() : '';
  if (!['PHISHING','MALWARE','FRAUD','SPAM','IMPERSONATION','ILLEGAL_CONTENT','OTHER'].includes(category) || detail.length > 1000) { res.status(400).json({ success: false, error: { code: 'REPORT_INVALID', message: 'Selecciona una categoría válida.' } }); return; }
  const link = await prisma.shortLink.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
  if (!link) { res.status(404).json({ success: false, error: { code: 'SHORT_LINK_NOT_FOUND', message: 'Este enlace no existe.' } }); return; }
  const session = await authService.resolve(req.cookies?.[SESSION_COOKIE]);
  if (session && !authService.verifyCsrf(session, req.header('x-csrf-token'))) { res.status(403).json({ success: false, error: { code: 'CSRF_INVALID', message: 'Token CSRF inválido.' } }); return; }
  const report = await prisma.shortLinkReport.create({ data: { shortLinkId: link.id, reporterId: session?.userId, category: category as any, detail: detail || null } });
  res.status(201).json({ success: true, data: { id: report.id, status: report.status } });
});

export default router;
