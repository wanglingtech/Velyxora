import { isIP } from "node:net";
import { ENV } from "../config/env";
import { MediaAnalysisResult } from "../types/media";
import { YtDlpError, YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE, ytDlpService } from "../services/ytDlpService";
import {
  YouTubeCircuitBreakerService,
  YouTubeCircuitBreakerRejectedError,
  youtubeCircuitBreakerService,
  type YouTubeCircuitPermit,
} from "../services/youtubeCircuitBreakerService";
import { YtDlpProvider } from "./YtDlpProvider";

export const YOUTUBE_PO_PROVIDER_VERSION = "2.0.0";

export function parseInternalPoProviderUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const loopback = hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.");
    const privateDns = isIP(hostname) === 0 && (!hostname.includes(".") || hostname.endsWith(".internal"));
    if (url.protocol !== "http:" || !hostname || (!loopback && !privateDns)) return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) return null;
    return url;
  } catch {
    return null;
  }
}

export function buildYouTubeYtDlpArgs(providerUrl: URL): string[] {
  return [
    "--extractor-args", "youtube:player-client=mweb",
    "--extractor-args", `youtubepot-bgutilhttp:base_url=${providerUrl.origin}`,
  ];
}

export class YouTubeProvider extends YtDlpProvider {
  constructor(private readonly circuitBreaker: YouTubeCircuitBreakerService = youtubeCircuitBreakerService) {
    super("youtube", "YouTube", [/(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i]);
  }

  extractId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.replace(/^\//, '').split('?')[0];
      }
      return parsed.searchParams.get('v');
    } catch {
      return null;
    }
  }

  private async invocationArgs(): Promise<string[]> {
    const providerUrl = parseInternalPoProviderUrl(ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL);
    if (!providerUrl) {
      throw new YtDlpError("MEDIA_PROVIDER_RESTRICTED", "El proveedor interno de verificación de YouTube no está configurado de forma segura.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(new URL("/ping", providerUrl), { signal: controller.signal });
      if (!response.ok) throw new Error("unhealthy");
      // The provider's /ping response is intentionally treated as a liveness
      // check only; the plugin/image versions are pinned at build time.
    } catch {
      throw new YtDlpError("MEDIA_PROVIDER_RESTRICTED", "El proveedor interno de verificación de YouTube no está disponible.");
    } finally {
      clearTimeout(timeout);
    }
    return buildYouTubeYtDlpArgs(providerUrl);
  }

  private circuitError(): YtDlpError {
    return new YtDlpError("PROVIDER_TEMPORARILY_RESTRICTED", YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE);
  }

  private async acquireCircuit(): Promise<YouTubeCircuitPermit> {
    try {
      return await this.circuitBreaker.acquire();
    } catch (error) {
      if (error instanceof YouTubeCircuitBreakerRejectedError) throw this.circuitError();
      throw error;
    }
  }

  private async recordCircuitResult(permit: YouTubeCircuitPermit, outcome: "success" | "restriction" | "neutral"): Promise<void> {
    try {
      if (outcome === "success") await this.circuitBreaker.recordSuccess(permit);
      else if (outcome === "restriction") await this.circuitBreaker.recordRestriction(permit);
      else await this.circuitBreaker.recordNeutral(permit);
    } catch {
      throw this.circuitError();
    }
  }

  private async withCircuit<T>(operation: () => Promise<T>): Promise<T> {
    const permit = await this.acquireCircuit();
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      const restricted = error instanceof YtDlpError && error.code === "PROVIDER_TEMPORARILY_RESTRICTED";
      await this.recordCircuitResult(permit, restricted ? "restriction" : "neutral");
      throw error;
    }
    await this.recordCircuitResult(permit, "success");
    return result;
  }

  async analyze(url: string): Promise<MediaAnalysisResult> {
    return this.withCircuit(async () => ytDlpService.analyze(url, this.platform, await this.invocationArgs()));
  }

  async assertFormatAvailable(url: string, formatId: string): Promise<void> {
    return this.withCircuit(async () => ytDlpService.assertFormatAvailable(url, formatId, this.platform, await this.invocationArgs()));
  }

  async download(
    url: string,
    formatId: string,
    container: string,
    type: "video" | "audio",
    outputStem: string,
    signal?: AbortSignal,
    onProgress?: (value: number) => void,
  ): Promise<string> {
    return this.withCircuit(async () => ytDlpService.download(url, formatId, container, type, outputStem, signal, onProgress, this.platform, await this.invocationArgs()));
  }
}
