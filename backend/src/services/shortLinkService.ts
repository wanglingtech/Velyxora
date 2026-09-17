import { prisma } from '../db/prisma';

export type ShortLinkResolution =
  | { status: 'FOUND'; targetUrl: string; expiresAt: Date | null }
  | { status: 'NOT_FOUND' }
  | { status: 'EXPIRED' }
  | { status: 'DISABLED' }
  | { status: 'UNSAFE' };

export const MAX_SHORT_URL_LENGTH = 4096;

export function validateShortLinkTarget(raw: string): { valid: true; targetUrl: string } | { valid: false } {
  const hasControlCharacter = Array.from(raw).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (!raw || raw.length > MAX_SHORT_URL_LENGTH || hasControlCharacter) return { valid: false };
  try {
    const parsed = new URL(raw);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) return { valid: false };
    return { valid: true, targetUrl: parsed.toString() };
  } catch { return { valid: false }; }
}

export function isSafeRedirectTarget(target: string): boolean {
  try {
    const parsed = new URL(target);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function resolveShortLink(slug: string, countClick = true): Promise<ShortLinkResolution> {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(slug)) return { status: 'NOT_FOUND' };
  const link = await prisma.shortLink.findUnique({ where: { slug } });
  if (!link) return { status: 'NOT_FOUND' };
  if (link.status === 'DISABLED') return { status: 'DISABLED' };
  if (link.expiresAt && link.expiresAt <= new Date()) return { status: 'EXPIRED' };
  if (!isSafeRedirectTarget(link.targetUrl)) return { status: 'UNSAFE' };
  if (countClick) await prisma.shortLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } });
  return { status: 'FOUND', targetUrl: link.targetUrl, expiresAt: link.expiresAt };
}
