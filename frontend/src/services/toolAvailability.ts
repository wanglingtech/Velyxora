import type { ToolDefinition } from '../types';

// Services a tool may depend on. These keys mirror `BackendHealth['services']`
// and are the only ones tools are allowed to declare in `requiredServices`.
export type RequiredService = 'ffmpeg' | 'libreOffice' | 'ytDlp';

export type ServiceAvailability = (service: RequiredService) => boolean;

/**
 * Product-facing labels for each required service.
 * Tool cards are end-user UI: they must explain *why* a tool is unavailable
 * without exposing infrastructure names (FFmpeg, LibreOffice, yt-dlp, Railway).
 */
export const REQUIRED_SERVICE_LABELS: Record<RequiredService, string> = {
  ffmpeg: 'procesamiento de medios',
  libreOffice: 'documentos',
  ytDlp: 'descargas de video',
};

type ToolServiceInfo = Pick<ToolDefinition, 'requiredServices'>;

export function requiredServicesOf(tool: ToolServiceInfo): RequiredService[] {
  return tool.requiredServices ?? [];
}

/** Services declared by the tool whose backend dependency is currently down. */
export function getMissingServices(
  tool: ToolServiceInfo,
  isServiceAvailable: ServiceAvailability,
): RequiredService[] {
  return requiredServicesOf(tool).filter((service) => !isServiceAvailable(service));
}

/** A tool is in maintenance when at least one required service is unavailable. */
export function isToolInMaintenance(
  tool: ToolServiceInfo,
  isServiceAvailable: ServiceAvailability,
): boolean {
  return getMissingServices(tool, isServiceAvailable).length > 0;
}

export function countToolsInMaintenance(
  tools: ToolServiceInfo[],
  isServiceAvailable: ServiceAvailability,
): number {
  return tools.filter((tool) => isToolInMaintenance(tool, isServiceAvailable)).length;
}

/** Short, user-facing explanation used as the badge tooltip. */
export function maintenanceTooltip(missing: RequiredService[]): string {
  if (missing.length === 0) return '';
  const labels = missing.map((service) => REQUIRED_SERVICE_LABELS[service]).join(' y ');
  return `Herramienta no disponible mientras el servicio de ${labels} esté en mantenimiento. Las herramientas locales siguen funcionando.`;
}
