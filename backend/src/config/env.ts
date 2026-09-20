import path from "path";
import dotenv from "dotenv";
import type { CookieOptions } from "express";
import { normalizeWhatsAppPhoneE164 } from "./whatsapp";

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

export type SessionCookieSameSite = Extract<CookieOptions["sameSite"], "lax" | "none">;

export const resolveSessionCookieSameSite = (
  value: string | undefined,
  nodeEnv: string,
): SessionCookieSameSite => {
  const configured = value?.trim().toLowerCase();
  if (configured === "lax" || configured === "none") return configured;
  if (configured) throw new Error("SESSION_COOKIE_SAME_SITE debe ser 'lax' o 'none'.");
  return nodeEnv === "production" ? "none" : "lax";
};

const nodeEnv = process.env.NODE_ENV || "development";

const parseBoundedMegabytes = (name: string, value: string | undefined, fallback: number): number => {
  const megabytes = value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isFinite(megabytes) || megabytes < 1 || megabytes > 16_384) {
    throw new Error(`${name} debe ser un número entre 1 y 16384.`);
  }
  return megabytes * 1024 * 1024;
};

export const ENV = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT) || 3000,
  CORS_ORIGINS: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
  MAX_UPLOAD_SIZE_BYTES: parseBoundedMegabytes("MAX_UPLOAD_SIZE_MB", process.env.MAX_UPLOAD_SIZE_MB, 100),
  LOCAL_ADMIN_MAX_UPLOAD_SIZE_BYTES: parseBoundedMegabytes(
    "LOCAL_ADMIN_MAX_UPLOAD_SIZE_MB",
    process.env.LOCAL_ADMIN_MAX_UPLOAD_SIZE_MB,
    1024,
  ),
  STORAGE_DIR: resolveBackendPath(process.env.STORAGE_DIR, "storage"),
  TEMP_DIR: resolveBackendPath(process.env.TEMP_DIR, "temp"),
  TEMP_FILE_TTL_MS: Number(process.env.TEMP_FILE_TTL_MINUTES || 30) * 60 * 1000, // 30 minutes
  FFMPEG_PATH: process.env.FFMPEG_PATH || "ffmpeg",
  FFPROBE_PATH: process.env.FFPROBE_PATH || "ffprobe",
  FFMPEG_TIMEOUT_MS: Number(process.env.FFMPEG_TIMEOUT_MS || 10 * 60 * 1000),
  YT_DLP_PATH: process.env.YT_DLP_PATH || "yt-dlp",
  YT_DLP_TIMEOUT_MS: Number(process.env.YT_DLP_TIMEOUT_MS || 10 * 60 * 1000),
  YOUTUBE_PO_TOKEN_PROVIDER_URL: process.env.YOUTUBE_PO_TOKEN_PROVIDER_URL || "",
  YOUTUBE_DIAGNOSTICS_ENABLED: process.env.YOUTUBE_DIAGNOSTICS_ENABLED === "true",
  MEDIA_STAGING_DIAGNOSTICS: process.env.MEDIA_STAGING_DIAGNOSTICS === "true",
  LIBREOFFICE_PATH: process.env.LIBREOFFICE_PATH || "soffice",
  LIBREOFFICE_TIMEOUT_MS: Number(process.env.LIBREOFFICE_TIMEOUT_MS || 10 * 60 * 1000),
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 1000,
  TRUST_PROXY: process.env.TRUST_PROXY === "true" ? 1 : false,
  SESSION_COOKIE_SAME_SITE: resolveSessionCookieSameSite(
    process.env.SESSION_COOKIE_SAME_SITE,
    nodeEnv,
  ),
  WHATSAPP_ADMIN_PHONE: normalizeWhatsAppPhoneE164(process.env.WHATSAPP_ADMIN_PHONE_E164),
};
