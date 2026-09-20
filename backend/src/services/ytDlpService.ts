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
export type YouTubeDiagnosticStage = "analyze" | "revalidate-format" | "download";
type YtDlpRunResult = {
  stdout: string;
  warningCategories: string[];
  stagingTrace?: {
    runtime: StagingRuntimeDiagnostics;
    stderr: string;
    durationMs: number;
  };
};

export type ImpersonationTargetFamily = "chrome" | "edge" | "firefox" | "safari" | "tor" | "unknown";
export type TikTokExtractionStage = "http_initial" | "webpage_received" | "challenge_detection" | "metadata" | "formats" | "unknown";
export type TikTokResponseClassification = TikTokFailureReason | "success" | "http_error" | "unknown";

export type StagingRuntimeDiagnostics = {
  ytDlpVersion: string | null;
  curlCffiAvailable: boolean;
  curlCffiVersion: string | null;
  impersonationTargetsCount: number;
  impersonationBackend: "curl_cffi" | "none" | "unknown";
  pythonEnvironment: "venv" | "system" | "unknown";
};

export type TikTokStagingExtractionDiagnostics = StagingRuntimeDiagnostics & {
  provider: "tiktok";
  stage: "analyze";
  impersonationRequested: true;
  impersonationApplied: boolean | null;
  impersonationTargetFamily: ImpersonationTargetFamily | null;
  redirectOccurred: boolean | null;
  httpStatus: number | null;
  responseClassification: TikTokResponseClassification;
  extractionStage: TikTokExtractionStage;
  metadataObtained: boolean;
  rawFormatsCount: number;
  usableFormatsCount: number;
  durationMs: number;
};

const DIAGNOSTIC_BUFFER_LIMIT = 64 * 1024;

export type YouTubeRuntimeDiagnostic = {
  stage: YouTubeDiagnosticStage;
  playerClient: "mweb";
  pluginDetected: boolean | null;
  poProviderDetected: boolean | null;
  poProviderReachable: boolean | null;
  ejsDetected: boolean | null;
  jsRuntime: "node" | null;
};

export type YouTubePotDiagnostic = {
  stage: YouTubeDiagnosticStage;
  context: "gvs" | "player" | "subs" | "unknown";
  status: "success" | "failed" | "unavailable" | "not_required" | "unknown";
};

export type YouTubeJscDiagnostic = {
  stage: YouTubeDiagnosticStage;
  challenge: "signature" | "n" | "unknown";
  status: "requested" | "resolved" | "failed" | "unknown";
};

export type YouTubeRawFormatDiagnostic = {
  formatId: string | null;
  ext: string | null;
  hasVideoCodec: boolean;
  hasAudioCodec: boolean;
  protocol: string | null;
  formatNote: string | null;
};

export const shouldEnableYouTubeDiagnostics = (enabled: boolean, provider?: MediaPlatform): boolean =>
  enabled && provider === "youtube";

export const withYouTubeDiagnosticsArgs = (args: readonly string[], enabled: boolean): string[] =>
  enabled
    ? ["--verbose", "--extractor-args", "youtube:pot_trace=true;jsc_trace=true", ...args]
    : [...args];

export const buildEffectiveYtDlpArgs = (
  args: readonly string[],
  diagnosticsEnabled: boolean,
  provider?: MediaPlatform,
  youtubeStage?: YouTubeDiagnosticStage,
): string[] => withYouTubeDiagnosticsArgs(
  args,
  shouldEnableYouTubeDiagnostics(diagnosticsEnabled, provider) && Boolean(youtubeStage),
);

const safeDiagnosticLabel = (value: unknown, pattern: RegExp, maxLength = 120): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || !pattern.test(trimmed)) return null;
  if (/https?:|[?&=]|\b(?:token|cookie|authorization|visitor|session|secret|credential)\b/i.test(trimmed)) return null;
  return trimmed;
};

export function buildYouTubeRawFormatDiagnostics(formats: RawFormat[] = []): YouTubeRawFormatDiagnostic[] {
  return formats.map((format) => ({
    formatId: safeDiagnosticLabel(format.format_id, /^[A-Za-z0-9_.+-]+$/, 100),
    ext: safeDiagnosticLabel(format.ext, /^[A-Za-z0-9]+$/, 16),
    hasVideoCodec: hasUsableCodec(format.vcodec),
    hasAudioCodec: hasUsableCodec(format.acodec),
    protocol: safeDiagnosticLabel(format.protocol, /^[A-Za-z0-9_.+ -]+$/, 40),
    formatNote: safeDiagnosticLabel(format.format_note, /^[A-Za-z0-9][A-Za-z0-9 ._+()-]*$/, 120),
  }));
}

const diagnosticLines = (stderr: string): string[] => stderr.slice(0, DIAGNOSTIC_BUFFER_LIMIT).split(/\r?\n/);
const potContext = (line: string): YouTubePotDiagnostic["context"] =>
  (/\bgvs\b/i.test(line) ? "gvs" : /\bplayer\b/i.test(line) ? "player" : /\bsubs?(?:titles?)?\b/i.test(line) ? "subs" : "unknown");

export function parseYouTubeRuntimeDiagnostic(
  stderr: string,
  stage: YouTubeDiagnosticStage,
  providerPreflightReachable: boolean | null = null,
): YouTubeRuntimeDiagnostic {
  const lines = diagnosticLines(stderr);
  const providerLine = lines.find((line) => /PO Token Providers?:/i.test(line));
  const pluginDetected = providerLine ? /\bbgutil\b/i.test(providerLine) : null;
  const poProviderDetected = providerLine ? /\bbgutil:http(?:-|\b)/i.test(providerLine) : null;
  const unreachable = lines.some((line) => /(?:bgutil|po token).*(?:connection refused|unable to connect|connection error|timed? out|unreachable)/i.test(line));
  const ejsLine = lines.find((line) => /(?:JS Challenge Providers?|yt-dlp-ejs|\bejs\b)/i.test(line));
  return {
    stage,
    playerClient: "mweb",
    pluginDetected,
    poProviderDetected,
    poProviderReachable: unreachable ? false : providerPreflightReachable,
    ejsDetected: ejsLine ? /(?:yt-dlp-ejs|\bejs\b)/i.test(ejsLine) : null,
    jsRuntime: lines.some((line) => /(?:JS runtimes?|javascript runtime).*\bnode\b/i.test(line)) ? "node" : null,
  };
}

export function parseYouTubePotDiagnostics(stderr: string, stage: YouTubeDiagnosticStage): YouTubePotDiagnostic[] {
  const results = new Map<YouTubePotDiagnostic["context"], YouTubePotDiagnostic["status"]>();
  for (const line of diagnosticLines(stderr)) {
    if (!/\b(?:po token|pot)\b/i.test(line) || /PO Token Providers?:/i.test(line)) continue;
    const context = potContext(line);
    let status: YouTubePotDiagnostic["status"] = "unknown";
    if (/(?:not required|does not require|no token required)/i.test(line)) status = "not_required";
    else if (/(?:provider unavailable|no providers?|unavailable)/i.test(line)) status = "unavailable";
    else if (/(?:failed|failure|error|could not|unable to|missing)/i.test(line)) status = "failed";
    else if (/(?:success|generated|obtained|provided|fetched|using)/i.test(line)) status = "success";
    const previous = results.get(context);
    results.set(context, previous && previous !== status ? "unknown" : status);
  }
  const events: YouTubePotDiagnostic[] = [...results].map(([context, status]) => ({ stage, context, status }));
  return events.length ? events : [{ stage, context: "unknown", status: "unknown" }];
}

export function parseYouTubeJscDiagnostics(stderr: string, stage: YouTubeDiagnosticStage): YouTubeJscDiagnostic[] {
  const results = new Map<YouTubeJscDiagnostic["challenge"], YouTubeJscDiagnostic["status"]>();
  for (const line of diagnosticLines(stderr)) {
    if (/JS Challenge Providers?:/i.test(line)) continue;
    if (!/(?:challenge|signature|\bn parameter\b|\bn challenge\b)/i.test(line)) continue;
    const challenge: YouTubeJscDiagnostic["challenge"] = /signature|\bsig\b/i.test(line)
      ? "signature" : /\bn parameter\b|\bn challenge\b/i.test(line) ? "n" : "unknown";
    const status: YouTubeJscDiagnostic["status"] = /(?:failed|failure|error|could not|unable to)/i.test(line)
      ? "failed" : /(?:resolved|solved|success)/i.test(line) ? "resolved" : /(?:request|fetch|challenge)/i.test(line) ? "requested" : "unknown";
    results.set(challenge, status);
  }
  const events: YouTubeJscDiagnostic[] = [...results].map(([challenge, status]) => ({ stage, challenge, status }));
  return events.length ? events : [{ stage, challenge: "unknown", status: "unknown" }];
}

export const shouldEnableTikTokStagingDiagnostics = (
  enabled: boolean,
  provider: MediaPlatform | undefined,
  stage: YtDlpStage,
): boolean => enabled && provider === "tiktok" && stage === "analyze";

export const withTikTokStagingDiagnosticsArgs = (args: string[], enabled: boolean): string[] =>
  enabled ? ["--verbose", ...args] : args;

export const buildAnalyzeExecutionPlan = (url: string, stagingDiagnostics: boolean, providerArgs: readonly string[] = []): string[][] =>
  [withTikTokStagingDiagnosticsArgs(buildAnalyzeArgs(url, providerArgs), stagingDiagnostics)];

export function parseImpersonationTargetFamily(target: string): ImpersonationTargetFamily {
  const normalized = target.trim().toLowerCase();
  for (const family of ["chrome", "edge", "firefox", "safari", "tor"] as const) {
    if (normalized.startsWith(family)) return family;
  }
  return "unknown";
}

const safeHttpStatus = (value: string): number | null => {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
};

export function parseTikTokVerboseDiagnostics(stderr: string): Pick<TikTokStagingExtractionDiagnostics,
  "impersonationApplied" | "impersonationTargetFamily" | "redirectOccurred" | "httpStatus" | "extractionStage"> {
  let impersonationApplied: boolean | null = null;
  let impersonationTargetFamily: ImpersonationTargetFamily | null = null;
  let redirectOccurred: boolean | null = null;
  let httpStatus: number | null = null;
  let extractionStage: TikTokExtractionStage = "http_initial";

  for (const line of stderr.slice(0, DIAGNOSTIC_BUFFER_LIMIT).split(/\r?\n/)) {
    const target = /^\[debug\] \[TikTok\] Impersonation target: ([A-Za-z][A-Za-z0-9_:-]*)\s*$/.exec(line);
    if (target) {
      impersonationApplied = true;
      impersonationTargetFamily = parseImpersonationTargetFamily(target[1]);
      extractionStage = "webpage_received";
      continue;
    }
    if (/attempting impersonation, but no impersonate target is available/i.test(line)) {
      impersonationApplied = false;
      continue;
    }
    if (/^\[redirect\] Following redirect to /i.test(line)) {
      redirectOccurred = true;
      continue;
    }
    const status = /\bHTTP Error ([1-5][0-9]{2})\b/i.exec(line);
    if (status) httpStatus = safeHttpStatus(status[1]);
    if (/Unexpected response from webpage request|Unable to extract challenge data|Unable to solve JS challenge/i.test(line)) {
      extractionStage = "challenge_detection";
    } else if (/Unable to extract universal data for rehydration/i.test(line)) {
      extractionStage = "metadata";
    } else if (/Unable to extract webpage video data/i.test(line)) {
      extractionStage = "formats";
    }
  }

  return { impersonationApplied, impersonationTargetFamily, redirectOccurred, httpStatus, extractionStage };
}

export function parseStagingRuntimeDiagnostics(output: string): StagingRuntimeDiagnostics {
  const ytDlpVersionMatch = /^yt_dlp=([0-9]+(?:\.[0-9]+){1,3})$/m.exec(output);
  const versionMatch = /^curl_cffi=([0-9]+(?:\.[0-9]+){1,3})$/m.exec(output);
  const targetsMatch = /^impersonation_targets=([0-9]+)$/m.exec(output);
  const backendMatch = /^impersonation_backend=(curl_cffi|none)$/m.exec(output);
  const environmentMatch = /^python_environment=(venv|system)$/m.exec(output);
  const pythonEnvironment = environmentMatch?.[1] === "venv"
    ? "venv"
    : environmentMatch?.[1] === "system" ? "system" : "unknown";
  const impersonationBackend = backendMatch?.[1] === "curl_cffi"
    ? "curl_cffi"
    : backendMatch?.[1] === "none" ? "none" : versionMatch ? "unknown" : "none";
  const impersonationTargetsCount = targetsMatch ? Number(targetsMatch[1]) : 0;
  return {
    ytDlpVersion: ytDlpVersionMatch?.[1] || null,
    curlCffiAvailable: Boolean(versionMatch),
    curlCffiVersion: versionMatch?.[1] || null,
    impersonationTargetsCount,
    impersonationBackend,
    pythonEnvironment,
  };
}

export function buildTikTokStagingDiagnostic(
  runtime: StagingRuntimeDiagnostics,
  stderr: string,
  reason: TikTokFailureReason | "success",
  durationMs: number,
  formatCounts?: { raw: number; usable: number },
): TikTokStagingExtractionDiagnostics {
  const parsed = parseTikTokVerboseDiagnostics(stderr);
  return {
    provider: "tiktok", stage: "analyze", ...runtime,
    impersonationRequested: true,
    ...parsed,
    responseClassification: reason === "success" ? "success" : reason,
    extractionStage: reason === "success" ? "formats" : parsed.extractionStage,
    metadataObtained: reason === "success",
    rawFormatsCount: formatCounts?.raw || 0,
    usableFormatsCount: formatCounts?.usable || 0,
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}

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

export const buildAnalyzeArgs = (url: string, providerArgs: readonly string[] = []): string[] => [
  ...COMMON_ARGS,
  ...providerArgs,
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

export function buildDownloadArgs(
  url: string,
  formatId: string,
  container: string,
  type: "video" | "audio",
  outputStem: string,
  providerArgs: readonly string[] = [],
): string[] {
  const isMp3 = /^audio-mp3-(128|192|320)$/.exec(formatId);
  const args = [...COMMON_ARGS, ...providerArgs, "--newline", "--progress-template", "download:%(progress._percent_str)s"];
  if (isMp3) args.push("-x", "--audio-format", "mp3", "--audio-quality", `${isMp3[1]}K`);
  else if (type === "video") args.push("-f", `${formatId}+bestaudio/${formatId}`, "--merge-output-format", container);
  else args.push("-f", formatId);
  args.push("-o", `${outputStem}.%(ext)s`, "--", url);
  return args;
}

class YtDlpService {
  private version?: string;
  private stagingRuntimeDiagnostics?: Promise<StagingRuntimeDiagnostics>;

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

  async analyze(url: string, platform: MediaPlatform, providerArgs: readonly string[] = []): Promise<MediaAnalysisResult> {
    logger.info("YT_DLP_STAGE", {
      provider: platform,
      stage: "analyze",
      ...(platform === "youtube" ? { youtubeDiagnosticsEnabled: ENV.YOUTUBE_DIAGNOSTICS_ENABLED } : {}),
    });
    const { data, warningCategories, stagingTrace } = await this.extractInfo(url, "analyze", platform, providerArgs);
    const { diagnostics } = normalizeFormatsWithDiagnostics(data.formats);
    logger.info("MEDIA_ANALYZE_FORMATS", { provider: platform, ...diagnostics });
    if (shouldEnableYouTubeDiagnostics(ENV.YOUTUBE_DIAGNOSTICS_ENABLED, platform)) {
      for (const format of buildYouTubeRawFormatDiagnostics(data.formats)) {
        logger.info("YOUTUBE_DIAGNOSTICS_FORMATS", { stage: "analyze", ...format });
      }
    }
    if (stagingTrace) {
      logger.info("TIKTOK_STAGING_DIAGNOSTIC", buildTikTokStagingDiagnostic(
        stagingTrace.runtime,
        stagingTrace.stderr,
        "success",
        stagingTrace.durationMs,
        { raw: diagnostics.rawFormatsCount, usable: diagnostics.afterDeduplication },
      ));
    }
    assertUsableAnalysisFormats(platform, diagnostics, warningCategories);
    return parseAnalysis(data, url, platform);
  }

  async assertFormatAvailable(url: string, formatId: string, platform: MediaPlatform, providerArgs: readonly string[] = []): Promise<void> {
    logger.info("YT_DLP_STAGE", { provider: platform, stage: "process", action: "revalidate-format" });
    const { data } = await this.extractInfo(url, "process", platform, providerArgs);
    const analysis = parseAnalysis(data, url, platform);
    if (!isRequestedFormatAvailable(analysis.formats, formatId)) {
      throw new YtDlpError("FORMAT_UNAVAILABLE", "El formato seleccionado ya no está disponible. Analiza el recurso nuevamente.");
    }
  }

  private async extractInfo(url: string, stage: "analyze" | "process", platform: MediaPlatform, providerArgs: readonly string[] = []): Promise<{ data: RawInfo; warningCategories: string[]; stagingTrace?: YtDlpRunResult["stagingTrace"] }> {
    const stagingEnabled = shouldEnableTikTokStagingDiagnostics(ENV.MEDIA_STAGING_DIAGNOSTICS, platform, stage);
    const [args] = buildAnalyzeExecutionPlan(url, stagingEnabled, providerArgs);
    const diagnosticStage: YouTubeDiagnosticStage = stage === "analyze" ? "analyze" : "revalidate-format";
    const result = await this.run(args, stage, undefined, 30_000, undefined, platform, diagnosticStage);
    const data = JSON.parse(result.stdout) as RawInfo;
    if (shouldEnableYouTubeDiagnostics(ENV.YOUTUBE_DIAGNOSTICS_ENABLED, platform) && diagnosticStage === "revalidate-format") {
      for (const format of buildYouTubeRawFormatDiagnostics(data.formats)) {
        logger.info("YOUTUBE_DIAGNOSTICS_FORMATS", { stage: diagnosticStage, ...format });
      }
    }
    return { data, warningCategories: result.warningCategories, stagingTrace: result.stagingTrace };
  }

  async download(url: string, formatId: string, container: string, type: "video" | "audio", outputStem: string, signal?: AbortSignal, onProgress?: (value: number) => void, platform?: MediaPlatform, providerArgs: readonly string[] = []): Promise<string> {
    const args = buildDownloadArgs(url, formatId, container, type, outputStem, providerArgs);
    logger.info("YT_DLP_STAGE", { stage: "process" });
    await this.run(args, "process", signal, ENV.YT_DLP_TIMEOUT_MS, (line) => {
      const match = line.match(/download:\s*([\d.]+)%/);
      if (match) onProgress?.(Math.min(99, Number(match[1])));
    }, platform, "download");
    const files = fs.readdirSync(path.dirname(outputStem)).filter((name) => name.startsWith(`${path.basename(outputStem)}.`) && !name.endsWith(".part"));
    if (files.length !== 1) throw new YtDlpError("OUTPUT_MISSING", "La descarga no produjo un archivo válido.");
    return path.join(path.dirname(outputStem), files[0]);
  }

  private runLocalDiagnostic(command: string, args: string[], timeoutMs = 5000): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { windowsHide: true, shell: false });
      let output = "";
      const append = (chunk: unknown) => {
        if (output.length >= DIAGNOSTIC_BUFFER_LIMIT) return;
        output += String(chunk).slice(0, DIAGNOSTIC_BUFFER_LIMIT - output.length);
      };
      const timer = setTimeout(() => { child.kill(); resolve(output); }, timeoutMs);
      child.stdout.on("data", append);
      child.once("error", () => { clearTimeout(timer); resolve(""); });
      child.once("close", () => { clearTimeout(timer); resolve(output); });
    });
  }

  private getStagingRuntimeDiagnostics(): Promise<StagingRuntimeDiagnostics> {
    if (!this.stagingRuntimeDiagnostics) {
      const diagnosticScript = [
        "import sys, curl_cffi",
        "from yt_dlp.version import __version__ as ytdlp_version",
        "from yt_dlp.networking._curlcffi import CurlCFFIRH",
        "print('yt_dlp=' + ytdlp_version)",
        "print('curl_cffi=' + curl_cffi.__version__)",
        "print('impersonation_targets=' + str(len(CurlCFFIRH._SUPPORTED_IMPERSONATE_TARGET_MAP)))",
        "print('impersonation_backend=curl_cffi')",
        "print('python_environment=' + ('venv' if sys.prefix == '/opt/velyxora-ytdlp' else 'system'))",
      ].join("; ");
      this.stagingRuntimeDiagnostics = this.runLocalDiagnostic("python3", ["-c", diagnosticScript])
        .then(parseStagingRuntimeDiagnostics);
    }
    return this.stagingRuntimeDiagnostics;
  }

  private async run(args: string[], stage: YtDlpStage, signal?: AbortSignal, timeoutMs = ENV.YT_DLP_TIMEOUT_MS, onLine?: (line: string) => void, provider?: MediaPlatform, youtubeStage?: YouTubeDiagnosticStage): Promise<YtDlpRunResult> {
    const stagingEnabled = shouldEnableTikTokStagingDiagnostics(ENV.MEDIA_STAGING_DIAGNOSTICS, provider, stage);
    const youtubeDiagnosticsEnabled = shouldEnableYouTubeDiagnostics(ENV.YOUTUBE_DIAGNOSTICS_ENABLED, provider) && Boolean(youtubeStage);
    const runtime = stagingEnabled ? await this.getStagingRuntimeDiagnostics() : undefined;
    const effectiveArgs = buildEffectiveYtDlpArgs(args, ENV.YOUTUBE_DIAGNOSTICS_ENABLED, provider, youtubeStage);
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const child = spawn(ENV.YT_DLP_PATH, effectiveArgs, { windowsHide: true, shell: false });
      let stdout = "", stderr = "", diagnosticStderr = "";
      const timer = setTimeout(() => { child.kill(); reject(new YtDlpError("YT_DLP_TIMEOUT", "La operación excedió el tiempo permitido.")); }, timeoutMs);
      const abort = () => { child.kill(); reject(new YtDlpError("YT_DLP_CANCELLED", "Descarga cancelada.")); };
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk) => { const text = chunk.toString(); stdout += text; text.split(/\r?\n/).forEach((line: string) => onLine?.(line)); });
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if ((stagingEnabled || youtubeDiagnosticsEnabled) && diagnosticStderr.length < DIAGNOSTIC_BUFFER_LIMIT) {
          diagnosticStderr += text.slice(0, DIAGNOSTIC_BUFFER_LIMIT - diagnosticStderr.length);
        }
      });
      child.once("error", () => { clearTimeout(timer); reject(new YtDlpError("YT_DLP_NOT_AVAILABLE", "El motor de descargas no está disponible.")); });
      child.once("close", (code) => {
        clearTimeout(timer); signal?.removeEventListener("abort", abort);
        if (signal?.aborted) return;
        const durationMs = Date.now() - startedAt;
        if (youtubeDiagnosticsEnabled && youtubeStage) {
          logger.info("YOUTUBE_DIAGNOSTICS_RUNTIME", parseYouTubeRuntimeDiagnostic(diagnosticStderr, youtubeStage, true));
          for (const event of parseYouTubePotDiagnostics(diagnosticStderr, youtubeStage)) logger.info("YOUTUBE_DIAGNOSTICS_POT", event);
          for (const event of parseYouTubeJscDiagnostics(diagnosticStderr, youtubeStage)) logger.info("YOUTUBE_DIAGNOSTICS_JSC", event);
        }
        if (code === 0) {
          const warningCategories = classifyWarnings(stderr);
          if (warningCategories.length) logger.warn("YT_DLP_WARNINGS", { provider, stage, categories: warningCategories });
          resolve({
            stdout,
            warningCategories,
            stagingTrace: stagingEnabled && runtime ? { runtime, stderr: diagnosticStderr, durationMs } : undefined,
          });
        } else {
          if (provider === "tiktok") {
            logger.warn("TIKTOK_FAILURE_DIAGNOSTIC", buildTikTokFailureDiagnostic(stderr, stage, code));
          }
          if (stagingEnabled && runtime) {
            logger.warn("TIKTOK_STAGING_DIAGNOSTIC", buildTikTokStagingDiagnostic(
              runtime,
              diagnosticStderr,
              classifyTikTokFailure(stderr, provider),
              durationMs,
            ));
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
  const mentionsPoToken = /\b(?:po token|pot)\b/i.test(stderr);
  const poSuccess = /(?:po token|pot).*(?:success|generated|obtained|provided|fetched|using)/i.test(stderr);
  const poFailure = /(?:(?:po token|pot).*(?:failed|failure|could not|unable to|missing)|(?:failed|failure|could not|unable to|missing).*(?:po token|pot))/i.test(stderr);
  if (/no po token providers?|po token provider.*not (?:found|detected)/i.test(stderr)) categories.add("po_provider_not_detected");
  if (/(?:bgutil|po token).*(?:connection refused|unable to connect|connection error|timed? out|unreachable)/i.test(stderr)) categories.add("po_provider_unreachable");
  if (poFailure) categories.add("po_token_fetch_failed");
  if (poSuccess) categories.add("po_token_available");
  if (poSuccess && poFailure || /(?:some|partial).*po token|po token.*(?:some|partial)/i.test(stderr)) categories.add("po_token_partially_available");
  if (/(?:additional|another|separate).*(?:po token|pot)|(?:po token|pot).*(?:additional|another|separate).*context/i.test(stderr)) categories.add("po_additional_context_required");
  if (mentionsPoToken && categories.size === 0 && !/PO Token Providers?:/i.test(stderr)) categories.add("po_token_status_unknown");
  if (value.includes("sabr") || /formats?.*(?:skipped|unavailable).*(?:po token|pot)/i.test(stderr)) categories.add("youtube_format_restriction");
  if (value.includes("sign in to confirm") || value.includes("not a bot")) categories.add("bot_verification");
  if (value.includes("format") && value.includes("unavailable")) categories.add("formats_unavailable");
  if (value.includes("javascript runtime") || value.includes("challenge")) categories.add("javascript_challenge");
  if (/warning:/i.test(stderr) && categories.size === 0) categories.add("provider_warning");
  return [...categories];
}

export const ytDlpService = new YtDlpService();
