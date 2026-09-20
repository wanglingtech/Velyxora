import fs from "fs";
import path from "path";
import { InMemoryQueue } from "../jobs/InMemoryQueue";
import { jobManager } from "../jobs/JobManager";
import { ENV } from "../config/env";
import { providerRegistry } from "../providers/ProviderRegistry";
import { probeMedia } from "../utils/mediaProbe";
import { storageService } from "../services/storageService";
import { sanitizeFilename } from "../utils/sanitize";
import { logger } from "../utils/logger";
import { creditLedgerService } from "../services/creditLedgerService";

export const mediaDownloadQueue = new InMemoryQueue("media-downloads", 2);

mediaDownloadQueue.process(async (jobId, data: { url: string; formatId: string; container: string; type: "video" | "audio"; title: string; billingUserId?: string }) => {
  const job = jobManager.getJob(jobId);
  if (!job) return;
  const stem = path.join(ENV.STORAGE_DIR, `download-${jobId}`);
  try {
    jobManager.setStatus(jobId, "DOWNLOADING");
    jobManager.updateProgress(jobId, 0, "Descargando contenido público...");
    const provider = providerRegistry.find(data.url);
    if (provider === providerRegistry.generic || !provider.download) throw new Error("Este proveedor no está admitido actualmente.");
    const outputPath = await provider.download(data.url, data.formatId, data.container, data.type, stem, jobManager.getSignal(jobId), (progress) => jobManager.updateProgress(jobId, progress, "Descargando..."));
    if (jobManager.getJob(jobId)?.status === "CANCELLED") { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); return; }
    jobManager.setStatus(jobId, "PROCESSING");
    jobManager.updateProgress(jobId, 99, "Validando archivo...");
    const probe = await probeMedia(outputPath);
    if (!probe.streams.length) throw new Error("El archivo descargado no contiene streams multimedia válidos.");
    const extension = path.extname(outputPath);
    const filename = sanitizeFilename(`${data.title || "media"}${extension}`);
    const stored = storageService.registerOutput(outputPath, filename, mimeFor(extension), job.ownerId);
    jobManager.updateJob(jobId, { output: {
      fileId: stored.fileId, filename, mimeType: stored.mimeType, size: stored.size,
      path: stored.path, downloadUrl: `/api/download/${stored.fileId}`,
      duration: probe.duration,
      width: probe.streams.find((stream) => stream.codecType === "video")?.width,
      height: probe.streams.find((stream) => stream.codecType === "video")?.height,
    }, metadata: { probe } });
    jobManager.updateProgress(jobId, 100, "Descarga lista.");
    jobManager.setStatus(jobId, "COMPLETED");
    if (data.billingUserId) await creditLedgerService.settle(jobId, 'COMPLETED');
  } catch (error: any) {
    for (const filename of fs.readdirSync(ENV.STORAGE_DIR)) if (filename.startsWith(`download-${jobId}.`)) fs.unlinkSync(path.join(ENV.STORAGE_DIR, filename));
    if (jobManager.getJob(jobId)?.status !== "CANCELLED") {
      logger.warn(`Media download ${jobId} failed: ${error.message}`);
      jobManager.setStatus(jobId, "FAILED", error.message);
      if (data.billingUserId) await creditLedgerService.settle(jobId, 'FAILED');
    }
  }
});

function mimeFor(extension: string): string {
  return ({ ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".opus": "audio/ogg", ".webm": "video/webm", ".mp4": "video/mp4" } as Record<string, string>)[extension.toLowerCase()] || "application/octet-stream";
}
