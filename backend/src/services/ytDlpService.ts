import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";
import { MediaAnalysisResult, MediaPlatform, MediaStreamFormat } from "../types/media";

export type RawFormat = {
  format_id?: string; ext?: string; vcodec?: string; acodec?: string;
  width?: number; height?: number; fps?: number; tbr?: number; abr?: number;
  filesize?: number; filesize_approx?: number; format_note?: string;
};

export type RawInfo = {
  webpage_url?: string; title?: string; uploader?: string; channel?: string;
  uploader_url?: string; thumbnail?: string; duration?: number; extractor_key?: string;
  formats?: RawFormat[];
};

export class YtDlpError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export type YtDlpStage = "analyze" | "process" | "diagnostic";

export function friendlyError(stderr: string, stage: YtDlpStage): YtDlpError {
  const value = stderr.toLowerCase();
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

export function normalizeFormats(formats: RawFormat[] = []): MediaStreamFormat[] {
  const normalized: MediaStreamFormat[] = [];
  const seen = new Set<string>();
  for (const item of formats) {
    if (!item.format_id || !item.ext) continue;
    const hasVideo = Boolean(item.vcodec && item.vcodec !== "none");
    const hasAudio = Boolean(item.acodec && item.acodec !== "none");
    if (!hasVideo && !hasAudio) continue;
    const type = hasVideo ? "video" : "audio";
    const resolution = hasVideo && item.height ? `${item.height}p` : undefined;
    const bitrate = Math.round(item.abr || item.tbr || 0) || undefined;
    const key = `${type}:${item.ext}:${resolution || bitrate || item.format_id}:${hasAudio}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      formatId: item.format_id, type, container: item.ext, extension: item.ext,
      resolution, qualityLabel: item.format_note || resolution || (bitrate ? `${bitrate} kbps` : item.ext.toUpperCase()),
      hasVideo, hasAudio, estimatedSize: item.filesize || item.filesize_approx,
      codec: hasVideo ? item.vcodec : item.acodec, fps: item.fps, bitrate,
    });
  }
  if (normalized.some((format) => format.hasAudio)) {
    for (const bitrate of [128, 192, 320]) normalized.push({
      formatId: `audio-mp3-${bitrate}`, type: "audio", container: "mp3", extension: "mp3",
      qualityLabel: `MP3 ${bitrate} kbps`, hasVideo: false, hasAudio: true, bitrate,
    });
  }
  return normalized.sort((a, b) => a.type.localeCompare(b.type) || (b.resolution || "").localeCompare(a.resolution || ""));
}

const COMMON_ARGS = ["--ignore-config", "--no-playlist", "--no-warnings", "--js-runtimes", "node"];

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
    thumbnailUrl: data.thumbnail, durationSeconds: data.duration,
    contentType: (data.formats || []).some((format) => format.vcodec && format.vcodec !== "none") ? "video" : "audio",
    formats, isDirectDownloadPossible: formats.length > 0,
    requiresExternalExtractor: true,
    notice: formats.length
      ? "Usa esta herramienta solo con contenido público o que tengas permiso para descargar."
      : "La metadata es pública, pero el proveedor no expuso formatos descargables.",
  };
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
      this.version = (await this.run(["--ignore-config", "--version"], "diagnostic", undefined, 5000)).trim();
      return this.version || null;
    } catch { return null; }
  }

  async analyze(url: string, platform: MediaPlatform): Promise<MediaAnalysisResult> {
    logger.info("YT_DLP_STAGE", { provider: platform, stage: "analyze" });
    const data = await this.extractInfo(url, "analyze", platform);
    return parseAnalysis(data, url, platform);
  }

  async assertFormatAvailable(url: string, formatId: string, platform: MediaPlatform): Promise<void> {
    logger.info("YT_DLP_STAGE", { provider: platform, stage: "process", action: "revalidate-format" });
    const data = await this.extractInfo(url, "process", platform);
    const analysis = parseAnalysis(data, url, platform);
    if (!isRequestedFormatAvailable(analysis.formats, formatId)) {
      throw new YtDlpError("FORMAT_UNAVAILABLE", "El formato seleccionado ya no está disponible. Analiza el recurso nuevamente.");
    }
  }

  private async extractInfo(url: string, stage: "analyze" | "process", platform: MediaPlatform): Promise<RawInfo> {
    const stdout = await this.run(buildAnalyzeArgs(url), stage, undefined, 30_000, undefined, platform);
    return JSON.parse(stdout) as RawInfo;
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

  private run(args: string[], stage: YtDlpStage, signal?: AbortSignal, timeoutMs = ENV.YT_DLP_TIMEOUT_MS, onLine?: (line: string) => void, provider?: MediaPlatform): Promise<string> {
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
        if (code === 0) resolve(stdout); else {
          const error = friendlyError(stderr, stage);
          logger.warn("YT_DLP_FAILURE", { provider, stage, category: error.code, exitCode: code });
          reject(error);
        }
      });
    });
  }
}

export const ytDlpService = new YtDlpService();
