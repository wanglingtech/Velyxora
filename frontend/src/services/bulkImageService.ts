/**
 * Pure helpers for the bulk image downloader module.
 *
 * The module accepts one image URL per line (or separated by commas/spaces),
 * keeps a per-item output format and builds safe, unique filenames. Actual
 * downloads go through the same SSRF-safe direct provider used by the media
 * downloader; conversions run locally in the browser.
 */

export type BulkImageOutputFormat = "original" | "image/png" | "image/jpeg" | "image/webp";

export interface BulkImageFormatOption {
  value: BulkImageOutputFormat;
  label: string;
  extension?: "png" | "jpg" | "webp";
}

export const BULK_IMAGE_FORMAT_OPTIONS: BulkImageFormatOption[] = [
  { value: "original", label: "Formato original" },
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPG" },
  { value: "image/webp", label: "WebP" },
];

export const DEFAULT_BULK_IMAGE_FORMAT: BulkImageOutputFormat = "original";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]);

export type BulkImageStatus = "pending" | "downloading" | "done" | "error";

export interface BulkImageItem {
  id: string;
  url: string;
  /** Filename without extension, derived from the URL at insertion time. */
  baseName: string;
  format: BulkImageOutputFormat;
  status: BulkImageStatus;
  error?: string;
}

const extensionFromFormat = (format: BulkImageOutputFormat): string | null => {
  if (format === "image/png") return "png";
  if (format === "image/jpeg") return "jpg";
  if (format === "image/webp") return "webp";
  return null;
};

/** Adds an https:// prefix when the user pastes `www.site.com/photo.jpg`. */
export const normalizeImageUrl = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/^[<"']+|[>"']+$/g, "");
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    // A public image URL needs a real host; `no-es-url` would parse as a bare
    // hostname and only fail much later during download.
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

/** Splits pasted text into unique, normalized http(s) URLs. */
export const parseBulkImageUrls = (raw: string): string[] => {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const token of raw.split(/[\s,;]+/)) {
    const url = normalizeImageUrl(token);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
};

export const extensionFromImageUrl = (url: string, fallback = "jpg"): string => {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
    const extension = match?.[1];
    return extension && IMAGE_EXTENSIONS.has(extension) ? (extension === "jpeg" ? "jpg" : extension) : fallback;
  } catch {
    return fallback;
  }
};

export const isLikelyImageUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,5})$/);
    return Boolean(match?.[1] && IMAGE_EXTENSIONS.has(match[1]));
  } catch {
    return false;
  }
};

const sanitizeBaseName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const baseNameFromImageUrl = (url: string, index = 0): string => {
  try {
    const pathname = new URL(url).pathname;
    const last = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
    const withoutExtension = last.replace(/\.[a-z0-9]{2,5}$/i, "");
    return sanitizeBaseName(withoutExtension) || `imagen-${index + 1}`;
  } catch {
    return `imagen-${index + 1}`;
  }
};

/** Final filename for an item, honoring its per-item format. */
export const bulkItemFilename = (item: Pick<BulkImageItem, "url" | "baseName" | "format">): string => {
  const extension = extensionFromFormat(item.format) ?? extensionFromImageUrl(item.url);
  return `${item.baseName || "imagen"}.${extension}`;
};

let itemSequence = 0;

export const createBulkImageItem = (
  url: string,
  format: BulkImageOutputFormat = DEFAULT_BULK_IMAGE_FORMAT,
  index = 0,
): BulkImageItem => {
  itemSequence += 1;
  return {
    id: `bulk-image-${Date.now()}-${itemSequence}`,
    url,
    baseName: baseNameFromImageUrl(url, index),
    format,
    status: "pending",
  };
};

/** Ensures ZIP entries never collide when several URLs share a filename. */
export const uniqueFilename = (filename: string, used: Set<string>): string => {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  let candidate = filename;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${counter}${extension}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};
