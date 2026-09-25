// Product operational status — what users should consider VELYXORA's
// availability for normal use. This is intentionally distinct from component
// health (`/api/health`), which only reports whether technical components
// respond. MAINTENANCE is always an explicit administrator decision and is
// never inferred from health.

export const SERVICE_STATUS_STATES = [
  'OPERATIONAL',
  'LIMITED',
  'MAINTENANCE',
  'UNAVAILABLE',
] as const;

export type ServiceStatusState = (typeof SERVICE_STATUS_STATES)[number];

export const SERVICE_STATUS_MESSAGE_MAX_LENGTH = 200;

export function isServiceStatusState(value: unknown): value is ServiceStatusState {
  return typeof value === 'string' && (SERVICE_STATUS_STATES as readonly string[]).includes(value);
}

/**
 * Plain-text message policy: strings only, trimmed, bounded, and free of HTML
 * markup or script-like prefixes. Empty/whitespace becomes null.
 */
export function normalizeServiceStatusMessage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

export function isValidServiceStatusMessage(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length > SERVICE_STATUS_MESSAGE_MAX_LENGTH) return false;
  if (/<[^>]*>|javascript:/i.test(trimmed)) return false;
  return true;
}

export interface ServiceHealthSnapshot {
  status: 'ok' | 'degraded' | 'error';
  services: {
    ffmpeg: boolean;
    ffprobe: boolean;
    libreOffice: boolean;
    storage: boolean;
    ytDlp: boolean;
    database: boolean;
  };
}

/**
 * Public fallback signal derived from the real health snapshot. It only
 * degrades availability; MAINTENANCE is never inferred here.
 */
export function deriveServiceStatusState(health: ServiceHealthSnapshot | null): ServiceStatusState {
  if (!health) return 'UNAVAILABLE';
  if (health.status === 'error') return 'UNAVAILABLE';
  if (!health.services.database || !health.services.storage) return 'UNAVAILABLE';
  if (health.status === 'degraded') return 'LIMITED';
  if (!health.services.ffmpeg || !health.services.libreOffice || !health.services.ytDlp) return 'LIMITED';
  return 'OPERATIONAL';
}

/**
 * Resolves the effective public state: an explicit persisted administrator
 * state always wins; otherwise it falls back to the health-derived state.
 */
export function resolveServiceStatusState(
  persisted: ServiceStatusState | null | undefined,
  health: ServiceHealthSnapshot | null,
): ServiceStatusState {
  return persisted ?? deriveServiceStatusState(health);
}
