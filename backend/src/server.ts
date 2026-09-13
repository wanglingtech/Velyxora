import { backendApp } from "./app";
import { ENV } from "./config/env";
import { logger } from "./utils/logger";

const PORT = ENV.PORT;

backendApp.listen(PORT, "0.0.0.0", () => {
  logger.info(`VELYXORA Backend server listening at http://0.0.0.0:${PORT}`);
  logger.info(`Environment: ${ENV.NODE_ENV}`);
  logger.info(`FFmpeg path: ${ENV.FFMPEG_PATH}`);
  logger.info(`FFprobe path: ${ENV.FFPROBE_PATH}`);
  logger.info(`Storage dir: ${ENV.STORAGE_DIR}`);
});
