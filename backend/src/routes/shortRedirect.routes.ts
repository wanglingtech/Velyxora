import { Router } from 'express';
import { resolveShortLink } from '../services/shortLinkService';

const router = Router();
router.get('/:slug', async (req, res) => {
  const result = await resolveShortLink(req.params.slug);
  if (result.status === 'NOT_FOUND') { res.status(404).send('Enlace no encontrado.'); return; }
  if (result.status === 'EXPIRED') { res.status(410).send('Este enlace expiró.'); return; }
  if (result.status === 'UNSAFE') { res.status(422).send('El destino del enlace no es seguro.'); return; }
  res.redirect(302, result.targetUrl);
});
export default router;
