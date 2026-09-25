// Voluntary support configuration for VELYXORA.
//
// Support is strictly voluntary and separate from product usage: it never
// unlocks tools, grants credits, bypasses limits or creates privileged
// accounts. VELYXORA never processes payments or stores financial data; an
// "available" method only redirects to the official provider or displays a
// public payment identifier, and never collects donor or financial information.
//
// Provider modes:
//   external-link    -> official public HTTPS URL (PayPal, Ko-fi, ...)
//   public-identifier-> public payment number shown and copied manually
//   qr-display       -> static public QR asset (kept for future configuration)
//   coming-soon      -> no mechanism configured yet
//
// No provider is activated implicitly. To activate a method: set
// `state: 'available'` AND provide the explicit configuration for its mode:
//   - external-link: an official public HTTPS `url` on an allowed host;
//   - public-identifier: a plausible public `publicId` (never an account secret);
//   - qr-display: a static public `qrImageUrl` (same-origin path or HTTPS).
// Availability is always gated by `state`, never inferred from a string alone.
// Never invent phone numbers, QR codes, account names, usernames, identifiers
// or URLs here.

export type SupportRegion = "peru" | "international";
export type SupportMethodState = "available" | "coming-soon";
export type SupportMethodMode = "external-link" | "public-identifier" | "qr-display" | "coming-soon";

export interface SupportMethodConfig {
  id: string;
  name: string;
  region: SupportRegion;
  description: string;
  icon: string;
  mode: SupportMethodMode;
  state: SupportMethodState;
  /** Official public HTTPS URL. Required to activate an external-link method. */
  url?: string;
  /** Public payment identifier. Required to activate a public-identifier method. */
  publicId?: string;
  /** Public static QR asset (same-origin path or HTTPS URL) for qr-display. */
  qrImageUrl?: string;
}

export interface SupportRegionConfig {
  id: SupportRegion;
  name: string;
  flag: string;
  blurb: string;
}

export const SUPPORT_REGIONS: SupportRegionConfig[] = [
  { id: "peru", name: "Perú", flag: "🇵🇪", blurb: "Opciones para apoyar desde Perú." },
  { id: "international", name: "Internacional", flag: "🌎", blurb: "Opciones para apoyar desde fuera de Perú." },
];

// Only providers with explicitly supplied, validated public configuration are
// "available". Placeholder or missing values keep a method coming-soon.
export const SUPPORT_METHODS: SupportMethodConfig[] = [
  { id: "yape", name: "Yape", region: "peru", description: "Envía un apoyo puntual con el número público.", icon: "Smartphone", mode: "public-identifier", state: "available", publicId: "968555200" },
  { id: "plin", name: "Plin", region: "peru", description: "Envía un apoyo puntual con el número público.", icon: "Smartphone", mode: "public-identifier", state: "available", publicId: "968555200" },
  { id: "paypal", name: "PayPal", region: "international", description: "Apoyo puntual o recurrente en el sitio oficial de PayPal.", icon: "Wallet", mode: "external-link", state: "available", url: "https://paypal.me/WangLing79" },
  { id: "kofi", name: "Ko-fi", region: "international", description: "Apoyo puntual o recurrente en el sitio oficial de Ko-fi.", icon: "Coffee", mode: "external-link", state: "available", url: "https://ko-fi.com/wanglingt" },
  // GitHub Sponsors must stay coming-soon: its payout onboarding is not complete.
  { id: "github-sponsors", name: "GitHub Sponsors", region: "international", description: "Apoyo recurrente desde GitHub (incorporación pendiente).", icon: "Github", mode: "external-link", state: "coming-soon" },
];

// Official providers VELYXORA is allowed to redirect to. Any configured URL
// must be HTTPS, credential-free and on one of these hosts. `paypal.me` is the
// official PayPal.Me short-link host.
export const ALLOWED_SUPPORT_HOSTS = ["paypal.com", "paypal.me", "ko-fi.com", "github.com"] as const;

export function isSafeSupportUrl(url?: string): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_SUPPORT_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * A public payment identifier is a plausible public phone/payment number
 * (digits with optional single separators and an optional leading "+"). It is
 * never verified externally and never normalized into another account. Reject
 * empty values, letters/placeholder tokens and implausible lengths.
 */
export function isSafePublicId(value?: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^\+?[0-9][0-9\s.-]*$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

/**
 * A QR asset is a static public image. Accept a same-origin absolute path
 * (e.g. "/support/yape-qr.png") or a credential-free HTTPS URL. Reject
 * protocol-relative paths, traversal, data/javascript and credential URLs.
 */
export function isSafeQrAsset(src?: string): boolean {
  if (typeof src !== "string") return false;
  const value = src.trim();
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !value.includes("..") && !value.includes("\\");
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function getSupportMethods(region: SupportRegion): SupportMethodConfig[] {
  return SUPPORT_METHODS.filter((method) => method.region === region);
}

/**
 * A method is only actionable when its explicit configuration is complete:
 * external-link needs `state: 'available'` and a safe official URL;
 * public-identifier needs `state: 'available'` and a plausible public
 * identifier; qr-display needs `state: 'available'` and a safe static asset.
 * Presence of a URL, identifier or QR string alone never activates a method.
 */
export function isMethodAvailable(method: SupportMethodConfig): boolean {
  if (method.state !== "available") return false;
  switch (method.mode) {
    case "external-link":
      return isSafeSupportUrl(method.url);
    case "public-identifier":
      return isSafePublicId(method.publicId);
    case "qr-display":
      return isSafeQrAsset(method.qrImageUrl);
    default:
      return false;
  }
}
