import { isIP } from "node:net";
import { ENV } from "../config/env";
import { MediaAnalysisResult } from "../types/media";
import { YtDlpError, ytDlpService } from "../services/ytDlpService";
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
  constructor() {
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

  async analyze(url: string): Promise<MediaAnalysisResult> {
    return ytDlpService.analyze(url, this.platform, await this.invocationArgs());
  }

  async assertFormatAvailable(url: string, formatId: string): Promise<void> {
    return ytDlpService.assertFormatAvailable(url, formatId, this.platform, await this.invocationArgs());
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
    return ytDlpService.download(url, formatId, container, type, outputStem, signal, onProgress, this.platform, await this.invocationArgs());
  }
}
