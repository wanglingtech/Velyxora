import { backendApp } from "./app";
import { ENV } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./db/prisma";
import { ytDlpService } from "./services/ytDlpService";

const PORT = ENV.PORT;

const server = backendApp.listen(PORT, "0.0.0.0", () => {
  logger.info(`VELYXORA Backend server listening at http://0.0.0.0:${PORT}`);
  logger.info(`Environment: ${ENV.NODE_ENV}`);
  logger.info('PROCESSING_ENGINES_CONFIGURED', { ffmpeg: Boolean(ENV.FFMPEG_PATH), ffprobe: Boolean(ENV.FFPROBE_PATH), storage: Boolean(ENV.STORAGE_DIR) });
  void ytDlpService.getVersion().then((version) => logger.info('YT_DLP_DIAGNOSTIC', { version: version || 'unavailable' }));
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received; stopping HTTP traffic.`);
  const forceTimer = setTimeout(() => process.exit(1), 25_000);
  forceTimer.unref();
  server.close(async (error) => {
    try { await prisma.$disconnect(); }
    finally {
      clearTimeout(forceTimer);
      if (error) logger.error(`HTTP shutdown failed: ${error.message}`);
      process.exit(error ? 1 : 0);
    }
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
