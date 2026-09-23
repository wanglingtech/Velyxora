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

function safeWarn(message: string, meta?: Record<string, unknown>): void {
  try { logger.warn(message, meta); } catch { /* Logging must never block financial settlement. */ }
}

function setStatusWithLoggerTolerance(jobId: string, status: "DOWNLOADING" | "PROCESSING" | "COMPLETED" | "FAILED", error?: string): void {
  try {
    jobManager.setStatus(jobId, status, error);
  } catch (statusError) {
    if (jobManager.getJob(jobId)?.status !== status) throw statusError;
    safeWarn("MEDIA_DOWNLOAD_STATUS_LOG_FAILED", { jobId, status });
  }
}

export async function processMediaDownloadJob(jobId: string, data: { url: string; formatId: string; container: string; type: "video" | "audio"; title: string; billingUserId?: string }): Promise<void> {
  const job = jobManager.getJob(jobId);
  if (!job) return;
  const stem = path.join(ENV.STORAGE_DIR, `download-${jobId}`);
  try {
    setStatusWithLoggerTolerance(jobId, "DOWNLOADING");
    jobManager.updateProgress(jobId, 0, "Descargando contenido público...");
    const provider = providerRegistry.find(data.url);
    if (provider === providerRegistry.generic || !provider.download) throw new Error("Este proveedor no está admitido actualmente.");
    const outputPath = await provider.download(data.url, data.formatId, data.container, data.type, stem, jobManager.getSignal(jobId), (progress) => jobManager.updateProgress(jobId, progress, "Descargando..."));
    if (jobManager.getJob(jobId)?.status === "CANCELLED") { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); return; }
    setStatusWithLoggerTolerance(jobId, "PROCESSING");
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
    setStatusWithLoggerTolerance(jobId, "COMPLETED");
  } catch (error: any) {
    try {
      for (const filename of fs.readdirSync(ENV.STORAGE_DIR)) {
        if (!filename.startsWith(`download-${jobId}.`)) continue;
        try { fs.unlinkSync(path.join(ENV.STORAGE_DIR, filename)); }
        catch { safeWarn("MEDIA_DOWNLOAD_CLEANUP_FAILED", { jobId, operation: "unlink" }); }
      }
    } catch {
      safeWarn("MEDIA_DOWNLOAD_CLEANUP_FAILED", { jobId, operation: "list" });
    }
    if (jobManager.getJob(jobId)?.status !== "CANCELLED") {
      safeWarn("MEDIA_DOWNLOAD_FAILED", { jobId });
      try { setStatusWithLoggerTolerance(jobId, "FAILED", error.message); }
      catch { safeWarn("MEDIA_DOWNLOAD_STATUS_UPDATE_FAILED", { jobId }); }
      if (data.billingUserId) {
        try { await creditLedgerService.settle(jobId, 'FAILED'); }
        catch { safeWarn("MEDIA_DOWNLOAD_SETTLEMENT_FAILED", { jobId, outcome: "FAILED" }); }
      }
    }
    return;
  }
  if (data.billingUserId) {
    try { await creditLedgerService.settle(jobId, 'COMPLETED'); }
    catch { safeWarn("MEDIA_DOWNLOAD_SETTLEMENT_FAILED", { jobId, outcome: "COMPLETED" }); }
  }
}

mediaDownloadQueue.process(processMediaDownloadJob);

function mimeFor(extension: string): string {
  return ({ ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".opus": "audio/ogg", ".webm": "video/webm", ".mp4": "video/mp4" } as Record<string, string>)[extension.toLowerCase()] || "application/octet-stream";
}
