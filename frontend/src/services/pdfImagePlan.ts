import { parsePdfPageRange } from "./pdfEngine";

/** PDF pages can be rasterized in the browser, but a full book would freeze it. */
export const PDF_IMAGE_MAX_PAGES = 60;
export const PDF_IMAGE_MAX_PIXELS = 24_000_000;

export type PdfImageFormatId = "png" | "jpeg" | "webp";

export interface PdfImageFormatOption {
  id: PdfImageFormatId;
  mime: "image/png" | "image/jpeg" | "image/webp";
  label: string;
  extension: "png" | "jpg" | "webp";
  lossy: boolean;
}

export const PDF_IMAGE_FORMATS: PdfImageFormatOption[] = [
  { id: "png", mime: "image/png", label: "PNG", extension: "png", lossy: false },
  { id: "jpeg", mime: "image/jpeg", label: "JPG", extension: "jpg", lossy: true },
  { id: "webp", mime: "image/webp", label: "WebP", extension: "webp", lossy: true },
];

export interface PdfImageResolutionOption {
  id: string;
  label: string;
  scale: number;
}

/** 1 PDF point = 1/72 inch. Scales are expressed in output dots per inch. */
export const PDF_IMAGE_RESOLUTIONS: PdfImageResolutionOption[] = [
  { id: "normal", label: "Normal (96 ppp)", scale: 96 / 72 },
  { id: "alta", label: "Alta (150 ppp)", scale: 150 / 72 },
  { id: "maxima", label: "Máxima (200 ppp)", scale: 200 / 72 },
];

export const getPdfImageFormat = (format: PdfImageFormatId): PdfImageFormatOption =>
  PDF_IMAGE_FORMATS.find((option) => option.id === format) ?? PDF_IMAGE_FORMATS[0];

export const getPdfImageResolution = (id: string): PdfImageResolutionOption =>
  PDF_IMAGE_RESOLUTIONS.find((option) => option.id === id) ?? PDF_IMAGE_RESOLUTIONS[0];

export const pdfImageFilename = (pageNumber: number, format: PdfImageFormatId): string =>
  `pagina-${String(pageNumber).padStart(2, "0")}.${getPdfImageFormat(format).extension}`;

export const pdfImagesZipFilename = (sourceName?: string): string => {
  const base = (sourceName || "documento")
    .replace(/\.pdf$/i, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "documento"}-paginas.zip`;
};

/** Clamps the raster size so a huge page cannot exhaust the tab's memory. */
export const clampPdfRenderScale = (
  baseWidth: number,
  baseHeight: number,
  requestedScale: number,
): number => {
  const width = Math.max(1, baseWidth);
  const height = Math.max(1, baseHeight);
  const safeRequested = Math.max(0.25, Math.min(4, requestedScale || 1));
  const pixelScale = Math.sqrt(PDF_IMAGE_MAX_PIXELS / (width * height));
  return Math.max(0.1, Math.min(safeRequested, pixelScale));
};

/**
 * Expands a page range expression and enforces the per-run page cap. Uses the
 * shared parser so "1-3,5,8-" behaves exactly like the other PDF tools.
 */
export const resolvePdfImagePages = (range: string, pageCount: number): number[] => {
  const pages = parsePdfPageRange(range, pageCount);
  if (pages.length > PDF_IMAGE_MAX_PAGES) {
    throw new Error(
      `Puedes convertir hasta ${PDF_IMAGE_MAX_PAGES} páginas a la vez. Ajusta el rango para continuar.`,
    );
  }
  return pages;
};
