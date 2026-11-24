import { createWriteStream, unlinkSync } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { BaseMediaProvider } from "./MediaProvider";
import { MediaAnalysisResult, MediaPlatform, MediaStreamType } from "../types/media";
import { validateSafeUrl } from "../security/ssrfValidator";
import { YtDlpError } from "../services/ytDlpService";

/**
 * Downloads a URL that already points at a media file (image, video or audio)
 * on any host. yt-dlp is a site extractor, not a file downloader, so direct
 * links such as `https://site.tld/photo.jpg` used to fail with
 * "unsupported URL". This provider fills that gap while keeping the same SSRF
 * protections: every redirect hop is validated before it is followed.
 */
const DIRECT_FORMAT_ID = "direct";
const MAX_REDIRECTS = 5;
const MAX_BYTES = Number(process.env.DIRECT_MEDIA_MAX_BYTES) || 512 * 1024 * 1024;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

const EXTENSION_KIND: Record<string, MediaStreamType> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image", avif: "image", bmp: "image",
  mp4: "video", webm: "video", mov: "video", mkv: "video",
  mp3: "audio", m4a: "audio", ogg: "audio", wav: "audio", opus: "audio", flac: "audio",
};

const SAFE_EXTENSION = /^[a-z0-9]{1,5}$/;

async function fetchFollowingSafeRedirects(
  target: string,
  init: RequestInit,
): Promise<Response> {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const safety = await validateSafeUrl(current);
    if (!safety.valid) throw new YtDlpError("UNSUPPORTED_URL", safety.error || "URL no permitida.");
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) return response;
    current = new URL(location, current).toString();
  }
  throw new YtDlpError("UNSUPPORTED_URL", "El enlace redirige demasiadas veces.");
}

type DirectMediaDescriptor = {
  kind: MediaStreamType;
  extension: string;
  mimeType: string;
  filename: string;
  size?: number;
};

function extensionFor(contentType: string, url: string): string | undefined {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const fromMime = EXTENSION_BY_MIME[mime];
  if (fromMime) return fromMime;
  try {
    const fromUrl = path.extname(new URL(url).pathname).slice(1).toLowerCase();
    return SAFE_EXTENSION.test(fromUrl) ? fromUrl : undefined;
  } catch {
    return undefined;
  }
}

function kindFor(contentType: string, extension: string): MediaStreamType | undefined {
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return EXTENSION_KIND[extension];
}

function filenameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1].replace(/"/g, "")).trim() || undefined;
  } catch {
    return undefined;
  }
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const base = decodeURIComponent(path.basename(parsed.pathname));
    return base && base !== "/" ? base : parsed.hostname;
  } catch {
    return "Archivo multimedia";
  }
}

async function describe(url: string): Promise<DirectMediaDescriptor> {
  const head = await fetchFollowingSafeRedirects(url, { method: "HEAD" });
  let contentType = head.headers.get("content-type") || "";
  let disposition = head.headers.get("content-disposition");
  let size = Number(head.headers.get("content-length") || 0) || undefined;
  await head.body?.cancel();

  if (!contentType || contentType.startsWith("text/")) {
    const probe = await fetchFollowingSafeRedirects(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    contentType = probe.headers.get("content-type") || contentType;
    disposition = disposition || probe.headers.get("content-disposition");
    const rangeTotal = probe.headers.get("content-range")?.split("/").pop();
    size = Number(rangeTotal || probe.headers.get("content-length") || 0) || size;
    await probe.body?.cancel();
  }

  const extension = extensionFor(contentType, url);
  const kind = extension ? kindFor(contentType, extension) : kindFor(contentType, "");
  if (!extension || !kind) {
    throw new YtDlpError(
      "UNSUPPORTED_URL",
      "El enlace no apunta a un archivo de imagen, video o audio descargable directamente. Para redes sociales usa su enlace de publicación.",
    );
  }
  return {
    kind,
    extension,
    mimeType: contentType.split(";")[0].trim().toLowerCase() || "application/octet-stream",
    filename: filenameFromDisposition(disposition) || titleFromUrl(url),
    size,
  };
}

export class DirectMediaProvider extends BaseMediaProvider {
  readonly platform: MediaPlatform = "generic";
  readonly name = "Enlace directo";
  readonly domainPatterns = [/.*/];

  extractId(url: string): string | null {
    return url;
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    const media = await describe(url);
    return {
      url,
      platform: this.platform,
      title: media.filename,
      author: new URL(url).hostname,
      thumbnailUrl: media.kind === "image" ? url : undefined,
      contentType: media.kind,
      formats: [{
        formatId: DIRECT_FORMAT_ID,
        type: media.kind,
        container: media.extension,
        extension: media.extension,
        qualityLabel: `Archivo ${media.extension.toUpperCase()}`,
        hasVideo: media.kind === "video",
        hasAudio: media.kind === "audio",
        estimatedSize: media.size,
        codec: undefined,
      }],
      isDirectDownloadPossible: true,
      requiresExternalExtractor: false,
      notice: "Descarga directa del archivo enlazado.",
    };
  }

  async assertFormatAvailable(_url: string, formatId: string): Promise<void> {
    if (formatId !== DIRECT_FORMAT_ID) {
      throw new YtDlpError("FORMAT_UNAVAILABLE", "El formato seleccionado ya no está disponible. Analiza el recurso nuevamente.");
    }
  }

  async download(
    url: string,
    formatId: string,
    container: string,
    type: "video" | "audio" | "image",
    outputStem: string,
    signal?: AbortSignal,
    onProgress?: (value: number) => void,
  ): Promise<string> {
    if (formatId !== DIRECT_FORMAT_ID) throw new YtDlpError("FORMAT_UNAVAILABLE", "Formato directo inválido.");
    const extension = SAFE_EXTENSION.test(container) ? container : type === "image" ? "jpg" : "bin";
    const outputPath = `${outputStem}.${extension}`;
    const response = await fetchFollowingSafeRedirects(url, { method: "GET", signal });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new YtDlpError("PROVIDER_UNAVAILABLE", `No se pudo descargar el archivo (HTTP ${response.status}).`);
    }
    const total = Number(response.headers.get("content-length") || 0);
    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_BYTES) {
          callback(new YtDlpError("FILE_TOO_LARGE", "El archivo supera el tamaño máximo permitido."));
          return;
        }
        if (total > 0) onProgress?.(Math.min(99, Math.round((received / total) * 100)));
        callback(null, chunk);
      },
    });
    try {
      await pipeline(
        Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
        limiter,
        createWriteStream(outputPath),
      );
    } catch (error) {
      try { unlinkSync(outputPath); } catch { /* best effort cleanup */ }
      throw error;
    }
    onProgress?.(99);
    return outputPath;
  }
}

export const directMediaProvider = new DirectMediaProvider();
