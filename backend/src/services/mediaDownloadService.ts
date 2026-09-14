import { randomUUID } from "crypto";
import { jobManager } from "../jobs/JobManager";
import { mediaDownloadQueue } from "../workers/mediaDownloadWorker";
import { validateSafeUrl } from "../security/ssrfValidator";
import { ytDlpService } from "./ytDlpService";
import { creditLedgerService } from "./creditLedgerService";

export const mediaDownloadService = {
  async start(url: string, formatId: string, container: string, type: "video" | "audio", title: string, billing?: { userId: string; isAdmin: boolean }) {
    const safety = await validateSafeUrl(url);
    if (!safety.valid) throw new Error(safety.error || "URL no permitida.");
    if (!/^[a-zA-Z0-9_.+-]{1,100}$/.test(formatId)) throw new Error("Formato seleccionado inválido.");
    if (!['mp4', 'webm', 'm4a', 'opus', 'mp3'].includes(container) || !['video', 'audio'].includes(type)) throw new Error("Formato seleccionado inválido.");
    if (!await ytDlpService.isAvailable()) throw new Error("El motor de descargas no está disponible.");
    const id = `media-${randomUUID()}`;
    if (billing) await creditLedgerService.reserve(billing.userId, id, 'media-downloader', 0, billing.isAdmin);
    const job = jobManager.createJob({
      id, ownerId: billing?.userId, toolId: "media-downloader",
      input: { filename: "remote-media", originalName: title || "Contenido multimedia", mimeType: "application/octet-stream", size: 0, path: "" },
      options: { formatId },
    });
    try { await mediaDownloadQueue.add(id, { url, formatId, container, type, title, billingUserId: billing?.userId }); }
    catch (error) { if (billing) await creditLedgerService.settle(id, 'FAILED'); throw error; }
    return job;
  },
};
