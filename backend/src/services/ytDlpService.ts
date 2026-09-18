import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";
import { MediaAnalysisResult, MediaPlatform, MediaStreamFormat } from "../types/media";

export type RawFormat = {
  format_id?: string; ext?: string; vcodec?: string; acodec?: string;
  width?: number; height?: number; fps?: number; tbr?: number; abr?: number;
  filesize?: number; filesize_approx?: number; format_note?: string; protocol?: string;
};

export type RawInfo = {
  webpage_url?: string; title?: string; uploader?: string; channel?: string;
  uploader_url?: string; thumbnail?: string; duration?: number; extractor_key?: string;
  thumbnails?: Array<{ url?: string; width?: number; height?: number; preference?: number }>;
  formats?: RawFormat[];
};

export type FormatDiagnostics = {
  rawFormatsCount: number; afterIdFilter: number; afterExtensionFilter: number;
  afterCodecFilter: number; afterDeduplication: number; normalizedFormatsCount: number;
  videoCount: number; audioCount: number; combinedCount: number;
};

export class YtDlpError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export type YtDlpStage = "analyze" | "process" | "diagnostic";
type YtDlpRunResult = { stdout: string; warningCategories: string[] };

export type TikTokFailureReason =
  | "post_access_restricted"
  | "challenge_data_unavailable"
  | "challenge_solve_failed"
  | "unexpected_webpage_response"
  | "web_data_unavailable"
  | "webpage_video_data_unavailable"
  | "login_required"
  | "sensitive_content_login_required"
  | "impersonation_unavailable"
  | "unclassified";

export type TikTokFailureDiagnostic = {
  provider: "tiktok";
  stage: YtDlpStage;
  reason: TikTokFailureReason;
  exitCode: number | null;
};

const TIKTOK_FATAL_FAILURE_PATTERNS: ReadonlyArray<readonly [string, TikTokFailureReason]> = [
  ["unable to extract challenge data", "challenge_data_unavailable"],
  ["unable to solve js challenge", "challenge_solve_failed"],
  ["unexpected response from webpage request", "unexpected_webpage_response"],
  ["unable to extract universal data for rehydration", "web_data_unavailable"],
  ["unable to extract webpage video data", "webpage_video_data_unavailable"],
];

const TIKTOK_ACCESS_FAILURE_PATTERNS: ReadonlyArray<readonly [string, TikTokFailureReason]> = [
  ["your ip address is blocked from accessing this post", "post_access_restricted"],
  ["tiktok is requiring login for access to this content", "login_required"],
  ["this post may not be comfortable for some audiences. log in for access", "sensitive_content_login_required"],
];

export function classifyTikTokFailure(stderr: string, provider?: MediaPlatform): TikTokFailureReason {
  if (provider !== "tiktok") return "unclassified";
  const value = stderr.toLowerCase();
  for (const [pattern, reason] of TIKTOK_FATAL_FAILURE_PATTERNS) {
    if (value.includes(pattern)) return reason;
  }
  for (const [pattern, reason] of TIKTOK_ACCESS_FAILURE_PATTERNS) {
    if (value.includes(pattern)) return reason;
  }
  if (value.includes("the extractor is attempting impersonation, but no impersonate target is available")) {
    return "impersonation_unavailable";
  }
  return "unclassified";
}

export function buildTikTokFailureDiagnostic(stderr: string, stage: YtDlpStage, exitCode: number | null): TikTokFailureDiagnostic {
  return { provider: "tiktok", stage, reason: classifyTikTokFailure(stderr, "tiktok"), exitCode };
}

export function friendlyError(stderr: string, stage: YtDlpStage, provider?: MediaPlatform): YtDlpError {
  const value = stderr.toLowerCase();
  if (provider === "tiktok" && value.includes("your ip address is blocked from accessing this post")) {
    return new YtDlpError("MEDIA_PROVIDER_RESTRICTED", "TikTok no permitió acceder a este contenido desde el servidor. Prueba con otra publicación pública o inténtalo más tarde.");
  }
  if (value.includes("requested format is not available") || value.includes("no video formats")) {
    return stage === "process"
      ? new YtDlpError("FORMAT_UNAVAILABLE", "El formato seleccionado ya no está disponible.")
      : new YtDlpError("ANALYZE_FORMATS_UNAVAILABLE", "No hay formatos públicos disponibles para analizar en este recurso.");
  }
  if (value.includes("cannot parse data") || value.includes("unable to extract")) return new YtDlpError("EXTRACTOR_CHANGED", "El proveedor cambió su sistema y este recurso público no puede analizarse actualmente.");
  if (value.includes("private") || value.includes("login") || value.includes("members-only") || value.includes("sign in")) return new YtDlpError("NOT_PUBLIC", "El contenido no está disponible públicamente.");
  if (value.includes("unsupported url")) return new YtDlpError("UNSUPPORTED_URL", "Esta URL no es compatible actualmente.");
  return new YtDlpError("PROVIDER_UNAVAILABLE", "El proveedor cambió su sistema o el contenido no está disponible temporalmente.");
}

const hasUsableCodec = (codec: unknown): boolean =>
  typeof codec === "string" && !["", "none", "unknown"].includes(codec.trim().toLowerCase());

export function normalizeFormatsWithDiagnostics(formats: RawFormat[] = []): { formats: MediaStreamFormat[]; diagnostics: FormatDiagnostics } {
  const normalized: MediaStreamFormat[] = [];
  const seen = new Set<string>();
  const withId = formats.filter((item) => typeof item.format_id === "string" && item.format_id.trim());
  const withExtension = withId.filter((item) => typeof item.ext === "string" && item.ext.trim());
  const withCodec = withExtension.filter((item) => hasUsableCodec(item.vcodec) || hasUsableCodec(item.acodec));
  for (const item of withCodec) {
    const hasVideo = hasUsableCodec(item.vcodec);
    const hasAudio = hasUsableCodec(item.acodec);
    const type = hasVideo ? "video" : "audio";
    const resolution = hasVideo && item.height ? `${item.height}p` : undefined;
    const bitrate = Math.round(item.abr || item.tbr || 0) || undefined;
    const key = `${item.format_id}:${type}:${item.ext}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      formatId: item.format_id, type, container: item.ext, extension: item.ext,
      resolution, qualityLabel: item.format_note || resolution || (bitrate ? `${bitrate} kbps` : item.ext.toUpperCase()),
      hasVideo, hasAudio, estimatedSize: item.filesize || item.filesize_approx,
      codec: hasVideo ? item.vcodec : item.acodec, fps: item.fps, bitrate,
    });
  }
  const afterDeduplication = normalized.length;
  if (normalized.some((format) => format.hasAudio)) {
    for (const bitrate of [128, 192, 320]) normalized.push({
      formatId: `audio-mp3-${bitrate}`, type: "audio", container: "mp3", extension: "mp3",
      qualityLabel: `MP3 ${bitrate} kbps`, hasVideo: false, hasAudio: true, bitrate,
    });
  }
  const sorted = normalized.sort((a, b) => a.type.localeCompare(b.type) || (b.resolution || "").localeCompare(a.resolution || ""));
  return { formats: sorted, diagnostics: {
    rawFormatsCount: formats.length, afterIdFilter: withId.length,
    afterExtensionFilter: withExtension.length, afterCodecFilter: withCodec.length,
    afterDeduplication, normalizedFormatsCount: sorted.length,
    videoCount: sorted.filter((format) => format.hasVideo).length,
    audioCount: sorted.filter((format) => format.hasAudio && !format.hasVideo).length,
    combinedCount: sorted.filter((format) => format.hasVideo && format.hasAudio).length,
  } };
}

export const normalizeFormats = (formats: RawFormat[] = []): MediaStreamFormat[] =>
  normalizeFormatsWithDiagnostics(formats).formats;

export function assertUsableAnalysisFormats(platform: MediaPlatform, diagnostics: FormatDiagnostics, warningCategories: string[] = []): void {
  if (diagnostics.afterDeduplication > 0) return;
  if (platform === "youtube" && warningCategories.includes("bot_verification")) {
    logger.warn("MEDIA_PROVIDER_RESTRICTED", { provider: platform, reason: "bot_verification" });
    throw new YtDlpError("MEDIA_PROVIDER_RESTRICTED", "El proveedor no permitió obtener los formatos de este contenido desde el servidor. Inténtalo más tarde o utiliza otro contenido compatible.");
  }
  const reason = diagnostics.rawFormatsCount === 0 ? "extractor_returned_no_formats" : "no_usable_audio_or_video_formats";
  logger.warn("MEDIA_FORMATS_UNAVAILABLE", { provider: platform, reason });
  throw new YtDlpError("MEDIA_FORMATS_UNAVAILABLE", "No fue posible obtener formatos descargables para este contenido.");
}

const COMMON_ARGS = ["--ignore-config", "--no-playlist", "--js-runtimes", "node"];

export const buildAnalyzeArgs = (url: string): string[] => [
  ...COMMON_ARGS,
  "--dump-single-json",
  "--skip-download",
  "--ignore-no-formats-error",
  "--",
  url,
];

export function parseAnalysis(data: RawInfo, requestedUrl: string, platform: MediaPlatform): MediaAnalysisResult {
  const formats = normalizeFormats(data.formats);
  return {
    url: data.webpage_url || requestedUrl, platform, title: data.title || "Contenido multimedia",
    author: data.uploader || data.channel || "Autor no disponible", authorUrl: data.uploader_url,
    thumbnailUrl: selectThumbnail(data), durationSeconds: data.duration,
    contentType: (data.formats || []).some((format) => format.vcodec && format.vcodec !== "none") ? "video" : "audio",
    formats, isDirectDownloadPossible: formats.length > 0,
    requiresExternalExtractor: true,
    notice: formats.length
      ? "Usa esta herramienta solo con contenido público o que tengas permiso para descargar."
      : "La metadata es pública, pero el proveedor no expuso formatos descargables.",
  };
}

export function selectThumbnail(data: RawInfo): string | undefined {
  const candidates = (data.thumbnails || [])
    .filter((item): item is { url: string; width?: number; height?: number; preference?: number } => typeof item.url === "string" && /^https:\/\//i.test(item.url))
    .filter((item) => !/maxresdefault\.(?:webp|jpg)(?:$|\?)/i.test(item.url))
    .sort((a, b) => ((b.preference || 0) - (a.preference || 0)) || ((b.width || 0) - (a.width || 0)));
  return candidates[0]?.url || data.thumbnail;
}

export const isRequestedFormatAvailable = (formats: MediaStreamFormat[], formatId: string): boolean =>
  formats.some((format) => format.formatId === formatId);

class YtDlpService {
  private version?: string;

  async isAvailable(): Promise<boolean> {
    return Boolean(await this.getVersion());
  }

  async getVersion(): Promise<string | null> {
    if (this.version) return this.version;
    try {
      this.version = (await this.run(["--ignore-config", "--version"], "diagnostic", undefined, 5000)).stdout.trim();
      return this.version || null;
    } catch { return null; }
  }

  async analyze(url: string, platform: MediaPlatform): Promise<MediaAnalysisResult> {
    logger.info("YT_DLP_STAGE", { provider: platform, stage: "analyze" });
    const { data, warningCategories } = await this.extractInfo(url, "analyze", platform);
    const { diagnostics } = normalizeFormatsWithDiagnostics(data.formats);
    logger.info("MEDIA_ANALYZE_FORMATS", { provider: platform, ...diagnostics });
    assertUsableAnalysisFormats(platform, diagnostics, warningCategories);
    return parseAnalysis(data, url, platform);
  }

  async assertFormatAvailable(url: string, formatId: string, platform: MediaPlatform): Promise<void> {
    logger.info("YT_DLP_STAGE", { provider: platform, stage: "process", action: "revalidate-format" });
    const { data } = await this.extractInfo(url, "process", platform);
    const analysis = parseAnalysis(data, url, platform);
    if (!isRequestedFormatAvailable(analysis.formats, formatId)) {
      throw new YtDlpError("FORMAT_UNAVAILABLE", "El formato seleccionado ya no está disponible. Analiza el recurso nuevamente.");
    }
  }

  private async extractInfo(url: string, stage: "analyze" | "process", platform: MediaPlatform): Promise<{ data: RawInfo; warningCategories: string[] }> {
    const result = await this.run(buildAnalyzeArgs(url), stage, undefined, 30_000, undefined, platform);
    return { data: JSON.parse(result.stdout) as RawInfo, warningCategories: result.warningCategories };
  }

  async download(url: string, formatId: string, container: string, type: "video" | "audio", outputStem: string, signal?: AbortSignal, onProgress?: (value: number) => void): Promise<string> {
    const isMp3 = /^audio-mp3-(128|192|320)$/.exec(formatId);
    const template = `${outputStem}.%(ext)s`;
    const args = [...COMMON_ARGS, "--newline", "--progress-template", "download:%(progress._percent_str)s"];
    if (isMp3) args.push("-x", "--audio-format", "mp3", "--audio-quality", `${isMp3[1]}K`);
    else if (type === "video") args.push("-f", `${formatId}+bestaudio/${formatId}`, "--merge-output-format", container);
    else args.push("-f", formatId);
    args.push("-o", template, "--", url);
    logger.info("YT_DLP_STAGE", { stage: "process" });
    await this.run(args, "process", signal, ENV.YT_DLP_TIMEOUT_MS, (line) => {
      const match = line.match(/download:\s*([\d.]+)%/);
      if (match) onProgress?.(Math.min(99, Number(match[1])));
    });
    const files = fs.readdirSync(path.dirname(outputStem)).filter((name) => name.startsWith(`${path.basename(outputStem)}.`) && !name.endsWith(".part"));
    if (files.length !== 1) throw new YtDlpError("OUTPUT_MISSING", "La descarga no produjo un archivo válido.");
    return path.join(path.dirname(outputStem), files[0]);
  }

  private run(args: string[], stage: YtDlpStage, signal?: AbortSignal, timeoutMs = ENV.YT_DLP_TIMEOUT_MS, onLine?: (line: string) => void, provider?: MediaPlatform): Promise<YtDlpRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(ENV.YT_DLP_PATH, args, { windowsHide: true, shell: false });
      let stdout = "", stderr = "";
      const timer = setTimeout(() => { child.kill(); reject(new YtDlpError("YT_DLP_TIMEOUT", "La operación excedió el tiempo permitido.")); }, timeoutMs);
      const abort = () => { child.kill(); reject(new YtDlpError("YT_DLP_CANCELLED", "Descarga cancelada.")); };
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk) => { const text = chunk.toString(); stdout += text; text.split(/\r?\n/).forEach((line: string) => onLine?.(line)); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.once("error", () => { clearTimeout(timer); reject(new YtDlpError("YT_DLP_NOT_AVAILABLE", "El motor de descargas no está disponible.")); });
      child.once("close", (code) => {
        clearTimeout(timer); signal?.removeEventListener("abort", abort);
        if (signal?.aborted) return;
        if (code === 0) {
          const warningCategories = classifyWarnings(stderr);
          if (warningCategories.length) logger.warn("YT_DLP_WARNINGS", { provider, stage, categories: warningCategories });
          resolve({ stdout, warningCategories });
        } else {
          if (provider === "tiktok") {
            logger.warn("TIKTOK_FAILURE_DIAGNOSTIC", buildTikTokFailureDiagnostic(stderr, stage, code));
          }
          const error = friendlyError(stderr, stage, provider);
          if (provider === "tiktok" && error.code === "MEDIA_PROVIDER_RESTRICTED") {
            logger.warn("MEDIA_PROVIDER_RESTRICTED", { provider, reason: "post_access_restricted" });
          }
          logger.warn("YT_DLP_FAILURE", { provider, stage, category: error.code, exitCode: code });
          reject(error);
        }
      });
    });
  }
}

export function classifyWarnings(stderr: string): string[] {
  const categories = new Set<string>();
  const value = stderr.toLowerCase();
  if (value.includes("po token")) categories.add("po_token_required");
  if (value.includes("sabr")) categories.add("sabr_restriction");
  if (value.includes("sign in to confirm") || value.includes("not a bot")) categories.add("bot_verification");
  if (value.includes("format") && value.includes("unavailable")) categories.add("formats_unavailable");
  if (value.includes("javascript runtime") || value.includes("challenge")) categories.add("javascript_challenge");
  if (/warning:/i.test(stderr) && categories.size === 0) categories.add("provider_warning");
  return [...categories];
}

export const ytDlpService = new YtDlpService();
