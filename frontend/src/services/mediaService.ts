import { MediaFormatOption, MediaMetadata } from "../types/media";
import { ApiError, apiClient, ConversionJobResponse, MediaAnalysisResponse } from "./apiClient";

interface MediaAdapter {
  id: string;
  name: string;
  matches: (url: string) => boolean;
  analyze: (url: string) => Promise<MediaMetadata>;
}

const createAdapter = (
  id: string,
  name: string,
  domains: string[],
): MediaAdapter => ({
  id,
  name,
  matches: (url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return domains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  },
  async analyze(url) {
    const analysis = await apiClient.analyzeMediaUrl(url);
    return normalizeMediaAnalysis(analysis, name);
  },
});

const extractEmbedUrl = (embedHtml?: string): string | undefined => {
  if (!embedHtml) return undefined;
  const match = embedHtml.match(/\bsrc=["']([^"']+)["']/i);
  return match?.[1];
};

export const normalizeMediaAnalysis = (
  analysis: MediaAnalysisResponse,
  platformLabel: string,
): MediaMetadata => {
  const formats = Array.isArray(analysis.formats) ? analysis.formats.flatMap((format) => {
    if (!format) return [];
    const formatId = [format.formatId, format.format_id, format.id].find((value) => typeof value === 'string' && value.trim())?.trim();
    const extension = [format.extension, format.container, format.ext].find((value) => typeof value === 'string' && value.trim())?.trim().toLowerCase();
    const declaredType = format.type || format.kind;
    const hasVideo = format.hasVideo === true || (Boolean(format.vcodec) && format.vcodec !== 'none') || declaredType === 'video';
    const hasAudio = format.hasAudio === true || (Boolean(format.acodec) && format.acodec !== 'none') || declaredType === 'audio';
    if (!formatId || !extension || (!hasVideo && !hasAudio)) return [];
    const type: 'video' | 'audio' = hasVideo ? 'video' : 'audio';
    const qualityLabel = format.qualityLabel || format.formatNote || format.format_note || format.label || format.resolution;
    return [{ ...format, formatId, extension, type, hasVideo, hasAudio, qualityLabel }];
  }) : [];
  return ({
  originalUrl: analysis.url,
  platform: analysis.platform,
  platformLabel,
  title: analysis.title,
  author: analysis.author,
  thumbnailUrl: analysis.thumbnailUrl,
  embedUrl: extractEmbedUrl(analysis.embedHtml),
    formattedDuration:
    analysis.durationSeconds === undefined
      ? undefined
      : `${Math.floor(analysis.durationSeconds / 60)}:${String(Math.round(analysis.durationSeconds % 60)).padStart(2, "0")}`,
  contentType: analysis.contentType,
  availableFormats: formats.map((format) => ({
    id: format.formatId,
    extension: format.extension,
    label:
      format.qualityLabel ||
      format.resolution ||
      format.extension.toUpperCase(),
    formatNote: format.qualityLabel || format.extension.toUpperCase(),
    streamType:
      format.hasVideo && format.hasAudio
        ? "Video + audio"
        : format.hasVideo
          ? "Video"
          : "Audio",
    resolution: format.resolution,
    qualityLabel: format.qualityLabel,
    qualityBadge: format.qualityLabel,
    hasVideo: format.hasVideo,
    hasAudio: format.hasAudio,
    directDownloadUrl: format.url,
    type: format.type,
    fps: format.fps,
    bitrate: format.bitrate,
    filesize: format.estimatedSize || format.filesize || format.filesizeApprox || format.filesize_approx,
    codec: format.codec,
  })),
  requiresServerEngine: analysis.requiresExternalExtractor,
  engineDetails: {
    backendEngine: analysis.notice || "Motor multimedia del backend",
    legalNote:
      analysis.notice ||
      "El análisis usa metadata autorizada del proveedor; la extracción directa requiere un motor externo.",
  },
  id: analysis.url,
  });
};

export const selectInitialMediaFormat = (metadata: MediaMetadata): MediaFormatOption | null =>
  metadata.availableFormats[0] ?? null;

export const EMPTY_MEDIA_FORMATS_MESSAGE = 'No se encontraron formatos compatibles para este contenido.';

export const shouldShowMediaThumbnail = (thumbnailUrl: string | undefined, failed: boolean): boolean =>
  Boolean(thumbnailUrl) && !failed;

export const mediaFormatActionLabel = (format: MediaFormatOption | null): string =>
  format
    ? `Descargar ${format.formatNote || format.label || format.extension.toUpperCase()}`
    : 'Selecciona un formato';

export const mediaAnalyzeErrorMessage = (error: unknown): string =>
  error instanceof ApiError && (error.status === 401 || error.code === 'AUTH_REQUIRED')
    ? 'Tu sesión no está disponible. Inicia sesión nuevamente.'
    : error instanceof ApiError && error.code === 'PROVIDER_TEMPORARILY_RESTRICTED'
      ? `${error.message} No se consumieron créditos.`
    : error instanceof Error
      ? error.message
      : 'No fue posible analizar esta URL.';

export const mediaDownloadStartErrorMessage = (error: unknown): string =>
  error instanceof ApiError && error.code === 'PROVIDER_TEMPORARILY_RESTRICTED'
    ? `${error.message} No se consumieron créditos.`
    : error instanceof Error
      ? error.message
      : 'No fue posible iniciar la descarga.';

export const canStartMediaAnalyze = (isAnalyzing: boolean, isProcessing: boolean): boolean =>
  !isAnalyzing && !isProcessing;

export const completedMediaOutput = (job: ConversionJobResponse): ConversionJobResponse['output'] | null => {
  if (job.status !== 'COMPLETED') return null;
  if (!job.output) throw new Error('El trabajo terminó sin un archivo de salida válido.');
  return job.output;
};

export const ALL_MEDIA_ADAPTERS: MediaAdapter[] = [
  createAdapter("youtube", "YouTube", ["youtube.com", "youtu.be"]),
  createAdapter("tiktok", "TikTok", ["tiktok.com"]),
  createAdapter("vimeo", "Vimeo", ["vimeo.com"]),
  createAdapter("instagram", "Instagram", ["instagram.com"]),
  createAdapter("x", "X / Twitter", ["x.com", "twitter.com"]),
  createAdapter("facebook", "Facebook", ["facebook.com"]),
  createAdapter("reddit", "Reddit", ["reddit.com"]),
  createAdapter("twitch", "Twitch", ["twitch.tv"]),
  createAdapter("soundcloud", "SoundCloud", ["soundcloud.com"]),
  createAdapter("generic", "Otros sitios compatibles", []),
];

export const findMatchingMediaAdapter = (
  url: string,
): MediaAdapter | undefined =>
  ALL_MEDIA_ADAPTERS.find((adapter) => adapter.id !== "generic" && adapter.matches(url)) || ALL_MEDIA_ADAPTERS.find((adapter) => adapter.id === "generic");
