export function normalizeWhatsAppPhoneE164(value: string | undefined): string | null {
  const configured = value?.trim();
  if (!configured) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(configured)) {
    throw new Error("WHATSAPP_ADMIN_PHONE_E164 debe usar formato E.164, por ejemplo +51968555200.");
  }
  return configured.slice(1);
}
