import { MediaMetadata } from "../types/media";
import { apiClient, MediaAnalysisResponse } from "./apiClient";

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
    return mapAnalysis(analysis, name);
  },
});

const extractEmbedUrl = (embedHtml?: string): string | undefined => {
  if (!embedHtml) return undefined;
  const match = embedHtml.match(/\bsrc=["']([^"']+)["']/i);
  return match?.[1];
};

const mapAnalysis = (
  analysis: MediaAnalysisResponse,
  platformLabel: string,
): MediaMetadata => ({
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
  availableFormats: analysis.formats.map((format) => ({
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

export const ALL_MEDIA_ADAPTERS: MediaAdapter[] = [
  createAdapter("youtube", "YouTube", ["youtube.com", "youtu.be"]),
  createAdapter("tiktok", "TikTok", ["tiktok.com"]),
  createAdapter("vimeo", "Vimeo", ["vimeo.com"]),
  createAdapter("instagram", "Instagram", ["instagram.com"]),
  createAdapter("x", "X / Twitter", ["x.com", "twitter.com"]),
  createAdapter("facebook", "Facebook", ["facebook.com"]),
  createAdapter("reddit", "Reddit", ["reddit.com"]),
];

export const findMatchingMediaAdapter = (
  url: string,
): MediaAdapter | undefined =>
  ALL_MEDIA_ADAPTERS.find((adapter) => adapter.matches(url));
