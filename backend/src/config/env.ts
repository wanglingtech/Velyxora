import path from "path";
import dotenv from "dotenv";

dotenv.config();

const backendRoot =
  path.basename(process.cwd()).toLowerCase() === "backend"
    ? process.cwd()
    : path.resolve(process.cwd(), "backend");

const resolveBackendPath = (
  configuredPath: string | undefined,
  fallback: string,
): string => {
  const target = configuredPath || fallback;
  return path.isAbsolute(target)
    ? path.normalize(target)
    : path.resolve(backendRoot, target);
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 3000,
  CORS_ORIGINS: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
  MAX_UPLOAD_SIZE_BYTES:
    Number(process.env.MAX_UPLOAD_SIZE_MB || 100) * 1024 * 1024, // 100MB default
  STORAGE_DIR: resolveBackendPath(process.env.STORAGE_DIR, "storage"),
  TEMP_DIR: resolveBackendPath(process.env.TEMP_DIR, "temp"),
  TEMP_FILE_TTL_MS: Number(process.env.TEMP_FILE_TTL_MINUTES || 30) * 60 * 1000, // 30 minutes
  FFMPEG_PATH: process.env.FFMPEG_PATH || "ffmpeg",
  FFPROBE_PATH: process.env.FFPROBE_PATH || "ffprobe",
  FFMPEG_TIMEOUT_MS: Number(process.env.FFMPEG_TIMEOUT_MS || 10 * 60 * 1000),
  YT_DLP_PATH: process.env.YT_DLP_PATH || "yt-dlp",
  YT_DLP_TIMEOUT_MS: Number(process.env.YT_DLP_TIMEOUT_MS || 10 * 60 * 1000),
  LIBREOFFICE_PATH: process.env.LIBREOFFICE_PATH || "soffice",
  LIBREOFFICE_TIMEOUT_MS: Number(process.env.LIBREOFFICE_TIMEOUT_MS || 10 * 60 * 1000),
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 1000,
};
