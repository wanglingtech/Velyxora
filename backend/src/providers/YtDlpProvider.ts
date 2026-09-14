import { BaseMediaProvider } from "./MediaProvider";
import { MediaAnalysisResult, MediaPlatform } from "../types/media";
import { ytDlpService } from "../services/ytDlpService";

export class YtDlpProvider extends BaseMediaProvider {
  constructor(
    readonly platform: MediaPlatform,
    readonly name: string,
    readonly domainPatterns: RegExp[],
    readonly restrictions = "Solo contenido público y autorizado.",
  ) { super(); }

  extractId(url: string): string | null { try { return new URL(url).pathname || "/"; } catch { return null; } }
  analyze(url: string): Promise<MediaAnalysisResult> { return ytDlpService.analyze(url, this.platform); }
}
