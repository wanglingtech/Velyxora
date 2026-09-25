import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db/prisma';

const router = Router();
router.use(requireAuth);

const serialize = (item: any) => ({
  ...item,
  inputSize: item.inputSize?.toString() ?? null,
  outputSize: item.outputSize?.toString() ?? null,
});

router.get('/', async (req, res) => {
  const requested = Number(req.query.limit || 50);
  const limit = Number.isSafeInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 50;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const items = await prisma.processingHistory.findMany({
    where: { userId: req.auth!.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  res.json({ success: true, data: { items: page.map(serialize), nextCursor: hasMore ? page.at(-1)?.id : null } });
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  if (typeof body.toolId !== 'string' || body.toolId.length < 1 || body.toolId.length > 100 ||
      !['COMPLETED', 'FAILED', 'CANCELLED'].includes(body.status) ||
      !['LOCAL', 'SERVER', 'EXTERNAL'].includes(body.processingType)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Los metadatos del historial no son válidos.' } }); return;
  }
  const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max ? value : undefined;
  const size = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? BigInt(Number(value)) : undefined;
  const jobId = text(body.jobId, 128);
  const data = {
    toolId: body.toolId, status: body.status, processingType: body.processingType,
    inputFileName: text(body.inputFileName, 255), inputSize: size(body.inputSize), inputMime: text(body.inputMime, 150),
    outputFileName: text(body.outputFileName, 255), outputSize: size(body.outputSize), jobId,
  };
  const item = jobId
    ? await prisma.processingHistory.upsert({ where: { userId_jobId: { userId: req.auth!.userId, jobId } }, update: data as any, create: { userId: req.auth!.userId, ...data } as any })
    : await prisma.processingHistory.create({ data: { userId: req.auth!.userId, ...data } as any });
  res.status(201).json({ success: true, data: serialize(item) });
});

router.delete('/:id', async (req, res) => {
  const deleted = await prisma.processingHistory.deleteMany({ where: { id: req.params.id, userId: req.auth!.userId } });
  if (!deleted.count) { res.status(404).json({ success: false, error: { code: 'HISTORY_NOT_FOUND', message: 'Elemento de historial no encontrado.' } }); return; }
  res.status(204).end();
});

export default router;
