import type { BackendHealth } from '../services/apiClient';

// Product operational state — what users should consider VELYXORA's
// availability for normal use. This is intentionally distinct from component
// health (`/api/health`), which only reports whether technical components
// respond. An admin-controlled, persistent product state will override the
// derivation below once a persistence mechanism is approved (see TOOLKIT-005C-2
// delivery notes); no such persistence exists yet.
export type ServiceOperationalState = 'OPERATIONAL' | 'LIMITED' | 'MAINTENANCE' | 'UNAVAILABLE';

export const SERVICE_OPERATIONAL_STATES: ServiceOperationalState[] = [
  'OPERATIONAL',
  'LIMITED',
  'MAINTENANCE',
  'UNAVAILABLE',
];

export const SERVICE_STATE_LABELS: Record<ServiceOperationalState, string> = {
  OPERATIONAL: 'Operativo',
  LIMITED: 'Limitado',
  MAINTENANCE: 'Mantenimiento',
  UNAVAILABLE: 'No disponible',
};

// Tailwind classes for the compact status chip. Status is never communicated
// by color alone: the label text is always rendered alongside the dot.
export const SERVICE_STATE_TONES: Record<ServiceOperationalState, string> = {
  OPERATIONAL: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  LIMITED: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  MAINTENANCE: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
  UNAVAILABLE: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

export const SERVICE_STATE_DOTS: Record<ServiceOperationalState, string> = {
  OPERATIONAL: 'bg-emerald-400',
  LIMITED: 'bg-amber-400',
  MAINTENANCE: 'bg-sky-400',
  UNAVAILABLE: 'bg-rose-400',
};

export function isServiceOperationalState(value: unknown): value is ServiceOperationalState {
  return typeof value === 'string' && (SERVICE_OPERATIONAL_STATES as string[]).includes(value);
}

/**
 * Public fallback signal derived from the real health endpoint. This only
 * degrades availability; MAINTENANCE is never inferred from components and is
 * reserved for an explicit (future, persistent) admin product state.
 */
export function deriveServiceOperationalState(health: BackendHealth | null): ServiceOperationalState {
  if (!health) return 'UNAVAILABLE';
  if (health.status === 'error') return 'UNAVAILABLE';
  if (!health.services.database || !health.services.storage) return 'UNAVAILABLE';
  if (health.status === 'degraded') return 'LIMITED';
  if (!health.services.ffmpeg || !health.services.libreOffice || !health.services.ytDlp) return 'LIMITED';
  return 'OPERATIONAL';
}

/**
 * Resolves the state to display. An explicit admin product state always wins;
 * otherwise the public signal falls back to the derived health-based state.
 */
export function resolveServiceOperationalState(
  adminState: ServiceOperationalState | null | undefined,
  health: BackendHealth | null,
): ServiceOperationalState {
  return adminState ?? deriveServiceOperationalState(health);
}
