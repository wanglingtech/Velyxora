import { randomUUID } from "crypto";
import { jobManager } from "../jobs/JobManager";
import { mediaDownloadQueue } from "../workers/mediaDownloadWorker";
import { validateSafeUrl } from "../security/ssrfValidator";
import { processingUsageService } from "./processingUsageService";
import { providerPolicyService } from "./providerPolicyService";
import { providerRegistry } from "../providers/ProviderRegistry";

export const mediaDownloadService = {
  async start(url: string, formatId: string, container: string, type: "video" | "audio", title: string, billing?: { userId: string; isAdmin: boolean }) {
    const provider = providerPolicyService.assertAllowed(url);
    const safety = await validateSafeUrl(url);
    if (!safety.valid) throw new Error(safety.error || "URL no permitida.");
    if (!/^[a-zA-Z0-9_.+-]{1,100}$/.test(formatId)) throw new Error("Formato seleccionado inválido.");
    if (!['mp4', 'webm', 'm4a', 'opus', 'mp3'].includes(container) || !['video', 'audio'].includes(type)) throw new Error("Formato seleccionado inválido.");
    const mediaProvider = providerRegistry.find(url);
    if (mediaProvider === providerRegistry.generic || mediaProvider.platform !== provider || !mediaProvider.assertFormatAvailable) throw new Error("Este proveedor no está admitido actualmente.");
    await mediaProvider.assertFormatAvailable(url, formatId);
    const id = `media-${randomUUID()}`;
    let reserved = false;
    if (billing) {
      await processingUsageService.reserve(billing.userId, id, 'media-downloader', 0, billing.isAdmin);
      reserved = true;
    }
    try {
      const job = jobManager.createJob({
        id, ownerId: billing?.userId, toolId: "media-downloader",
        input: { filename: "remote-media", originalName: title || "Contenido multimedia", mimeType: "application/octet-stream", size: 0, path: "" },
        options: { formatId },
      });
      await mediaDownloadQueue.add(id, { url, formatId, container, type, title, billingUserId: billing?.userId });
      return job;
    } catch (error) {
      if (reserved) await processingUsageService.settle(id, 'FAILED');
      throw error;
    }
  },
};
