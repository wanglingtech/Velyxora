import { rateLimit } from 'express-rate-limit';

const response = (req: any, res: any) => {
  const retryAfter = Math.max(1, Math.ceil(Number(res.getHeader('Retry-After') || 60)));
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Has realizado demasiadas solicitudes. Espera un momento e inténtalo nuevamente.', retryAfter } });
};

const build = (limit: number, windowMs = 15 * 60_000) => rateLimit({ windowMs, limit: process.env.NODE_ENV === 'production' ? limit : Math.max(limit, 100), standardHeaders: true, legacyHeaders: false, handler: response });

export const uploadLimit = build(20);
export const shortLinkCreateLimit = build(30);
export const shortLinkResolveLimit = build(300);
export const shortLinkReportLimit = build(10);
export const mediaAnalyzeLimit = build(30);
export const mediaProcessLimit = build(10);
export const adminMutationLimit = build(60);
