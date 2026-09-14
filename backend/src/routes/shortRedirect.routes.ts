import { Router } from 'express';
import { prisma } from '../db/prisma';

const router = Router();
router.get('/:slug', async (req, res) => {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(req.params.slug)) { res.status(404).send('Enlace no encontrado.'); return; }
  const link = await prisma.shortLink.findUnique({ where: { slug: req.params.slug } });
  if (!link || (link.expiresAt && link.expiresAt <= new Date())) { res.status(410).send('Este enlace no existe o expiró.'); return; }
  await prisma.shortLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } });
  res.redirect(302, link.targetUrl);
});
export default router;
