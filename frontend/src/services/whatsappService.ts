// Client-only WhatsApp helpers. No backend, no persistence, no external API.
// VELYXORA only builds user-controlled wa.me links/messages/QR codes; it never
// sends anything on the user's behalf.

export const WHATSAPP_MESSAGE_MAX_LENGTH = 4096;
export const WHATSAPP_LINK_PREFIX = 'https://wa.me/';

export interface PhoneNormalizationResult {
  ok: boolean;
  digits: string;
  e164: string;
  error?: string;
}

const ALLOWED_PHONE_CHARS = /^[+()\s.\-0-9]+$/;
const invalidPhone = (error: string): PhoneNormalizationResult => ({ ok: false, digits: '', e164: '', error });

/**
 * Normalizes a WhatsApp destination number without ever inventing a country
 * code. Only formatting characters are removed; the caller must already
 * include the international country code.
 */
export function normalizeWhatsAppPhone(raw: string): PhoneNormalizationResult {
  if (typeof raw !== 'string') return invalidPhone('Ingresa un número de teléfono.');
  const trimmed = raw.trim();
  if (!trimmed) return invalidPhone('Ingresa un número de teléfono.');
  if (!ALLOWED_PHONE_CHARS.test(trimmed)) {
    return invalidPhone('El número contiene caracteres no válidos. Usa solo dígitos, espacios, +, ( ) o -.');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return invalidPhone('Ingresa un número de teléfono.');
  if (digits.startsWith('00')) {
    return invalidPhone('No uses el prefijo 00. Escribe el número con su código de país.');
  }
  if (digits.length < 7 || digits.length > 15) {
    return invalidPhone('El número debe tener entre 7 y 15 dígitos, incluyendo el código de país.');
  }
  return { ok: true, digits, e164: `+${digits}` };
}

export function validateWhatsAppMessage(message: string): string | null {
  if (message.length > WHATSAPP_MESSAGE_MAX_LENGTH) {
    return `El mensaje no puede superar ${WHATSAPP_MESSAGE_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function encodeWhatsAppMessage(message: string): string {
  return encodeURIComponent(message.trim());
}

/**
 * Builds a WhatsApp click-to-chat link. Throws when the phone is invalid or the
 * message is too long so callers never open an arbitrary or malformed URL.
 */
export function buildWhatsAppLink(phone: string, message = ''): string {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized.ok) throw new Error(normalized.error || 'Número de teléfono inválido.');
  const messageError = validateWhatsAppMessage(message);
  if (messageError) throw new Error(messageError);
  const text = message.trim();
  const base = `${WHATSAPP_LINK_PREFIX}${normalized.digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Safe guard before opening a link in a new tab. */
export function isSafeWhatsAppLink(value: string): boolean {
  return typeof value === 'string' && value.startsWith(WHATSAPP_LINK_PREFIX);
}
