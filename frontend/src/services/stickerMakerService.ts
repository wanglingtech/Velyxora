export const STICKER_LIMITS = Object.freeze({
  maxInputBytes: 15 * 1024 * 1024,
  maxDimension: 8192,
  maxPixels: 40_000_000,
  outputSize: 512,
  targetBytes: 100 * 1024,
  minZoom: 1,
  maxZoom: 4,
  qualities: [0.92, 0.82, 0.72, 0.62, 0.52, 0.42] as readonly number[],
});

export const STICKER_FILENAME = "velyxora-sticker.webp";
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface StickerImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

export interface StickerEdit {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface StickerResult {
  blob: Blob;
  file: File;
  width: 512;
  height: 512;
  quality: number;
  attempts: number;
  compatible: boolean;
}

export const DEFAULT_STICKER_EDIT: StickerEdit = Object.freeze({ zoom: 1, offsetX: 0, offsetY: 0 });

function signatureMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

async function defaultDecode(file: File): Promise<StickerImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("STICKER_IMAGE_CORRUPT")); };
    image.src = url;
  });
}

export async function validateAndDecodeStickerImage(
  file: File,
  decode: (file: File) => Promise<StickerImage> = defaultDecode,
): Promise<StickerImage> {
  if (!ALLOWED_MIMES.has(file.type)) throw new Error("STICKER_MIME_UNSUPPORTED");
  if (!file.size) throw new Error("STICKER_IMAGE_EMPTY");
  if (file.size > STICKER_LIMITS.maxInputBytes) throw new Error("STICKER_INPUT_TOO_LARGE");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!signatureMatches(header, file.type)) throw new Error("STICKER_SIGNATURE_INVALID");
  let image: StickerImage;
  try { image = await decode(file); } catch { throw new Error("STICKER_IMAGE_CORRUPT"); }
  if (!Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width < 1 || image.height < 1) {
    image.close?.(); throw new Error("STICKER_DIMENSIONS_INVALID");
  }
  if (image.width > STICKER_LIMITS.maxDimension || image.height > STICKER_LIMITS.maxDimension || image.width * image.height > STICKER_LIMITS.maxPixels) {
    image.close?.(); throw new Error("STICKER_DIMENSIONS_TOO_LARGE");
  }
  return image;
}

export function clampStickerEdit(edit: StickerEdit): StickerEdit {
  return {
    zoom: Math.min(STICKER_LIMITS.maxZoom, Math.max(STICKER_LIMITS.minZoom, edit.zoom)),
    offsetX: Number.isFinite(edit.offsetX) ? edit.offsetX : 0,
    offsetY: Number.isFinite(edit.offsetY) ? edit.offsetY : 0,
  };
}

export function stickerDrawRect(width: number, height: number, edit: StickerEdit, size: number = STICKER_LIMITS.outputSize) {
  const safe = clampStickerEdit(edit);
  const scale = Math.max(size / width, size / height) * safe.zoom;
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return { x: (size - drawWidth) / 2 + safe.offsetX, y: (size - drawHeight) / 2 + safe.offsetY, width: drawWidth, height: drawHeight };
}

export function renderStickerCanvas(canvas: HTMLCanvasElement, image: StickerImage, edit: StickerEdit): void {
  canvas.width = STICKER_LIMITS.outputSize;
  canvas.height = STICKER_LIMITS.outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("STICKER_CANVAS_UNAVAILABLE");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const rect = stickerDrawRect(image.width, image.height, edit, canvas.width);
  context.drawImage(image.source, rect.x, rect.y, rect.width, rect.height);
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("STICKER_WEBP_EXPORT_FAILED")),
    "image/webp",
    quality,
  ));
}

export async function generateSticker(
  image: StickerImage,
  edit: StickerEdit,
  canvasFactory: () => HTMLCanvasElement = () => document.createElement("canvas"),
): Promise<StickerResult> {
  const canvas = canvasFactory();
  renderStickerCanvas(canvas, image, edit);
  let blob: Blob | null = null;
  let quality = STICKER_LIMITS.qualities[0];
  let attempts = 0;
  for (const candidate of STICKER_LIMITS.qualities) {
    quality = candidate;
    attempts += 1;
    blob = await canvasToWebp(canvas, candidate);
    if (blob.type !== "image/webp" || !blob.size) throw new Error("STICKER_WEBP_INVALID");
    if (blob.size <= STICKER_LIMITS.targetBytes) break;
  }
  if (!blob) throw new Error("STICKER_WEBP_EXPORT_FAILED");
  const file = new File([blob], STICKER_FILENAME, { type: "image/webp", lastModified: Date.now() });
  return { blob, file, width: 512, height: 512, quality, attempts, compatible: blob.size <= STICKER_LIMITS.targetBytes };
}
