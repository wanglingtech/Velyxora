import { randomUUID } from "crypto";
import { jobManager } from "../jobs/JobManager";
import { mediaDownloadQueue } from "../workers/mediaDownloadWorker";
import { validateSafeUrl } from "../security/ssrfValidator";
import { ytDlpService } from "./ytDlpService";

export const mediaDownloadService = {
  async start(url: string, formatId: string, container: string, type: "video" | "audio", title: string) {
    const safety = await validateSafeUrl(url);
    if (!safety.valid) throw new Error(safety.error || "URL no permitida.");
    if (!/^[a-zA-Z0-9_.+-]{1,100}$/.test(formatId)) throw new Error("Formato seleccionado inválido.");
    if (!['mp4', 'webm', 'm4a', 'opus', 'mp3'].includes(container) || !['video', 'audio'].includes(type)) throw new Error("Formato seleccionado inválido.");
    if (!await ytDlpService.isAvailable()) throw new Error("El motor de descargas no está disponible.");
    const id = `media-${randomUUID()}`;
    const job = jobManager.createJob({
      id, toolId: "media-downloader",
      input: { filename: "remote-media", originalName: title || "Contenido multimedia", mimeType: "application/octet-stream", size: 0, path: "" },
      options: { formatId },
    });
    await mediaDownloadQueue.add(id, { url, formatId, container, type, title });
    return job;
  },
};
