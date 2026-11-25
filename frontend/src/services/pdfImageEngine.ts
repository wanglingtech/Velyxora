/**
 * Client-side PDF rasterizer used by the "PDF a Imágenes" tool.
 *
 * pdf.js is loaded lazily so the rest of the app does not pay for the worker
 * bundle unless the user opens this tool. Rendering happens entirely in the
 * browser: the PDF never leaves the device.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  clampPdfRenderScale,
  getPdfImageFormat,
  pdfImageFilename,
  type PdfImageFormatId,
} from "./pdfImagePlan";

export interface RenderPdfImagesOptions {
  pages: number[];
  format: PdfImageFormatId;
  resolutionScale: number;
  quality: number;
  onProgress?: (done: number, total: number) => void;
}

export interface RenderedPdfImage {
  pageNumber: number;
  filename: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

type PdfJsModule = typeof import("pdfjs-dist");

let pdfJsPromise: Promise<PdfJsModule> | null = null;

const loadPdfJs = (): Promise<PdfJsModule> => {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((module) => {
      module.GlobalWorkerOptions.workerSrc = workerUrl;
      return module;
    });
  }
  return pdfJsPromise;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen de esta página."))),
      mime,
      mime === "image/png" ? undefined : quality,
    );
  });

const buildPreview = (canvas: HTMLCanvasElement): string => {
  const maxWidth = 420;
  const ratio = Math.min(1, maxWidth / Math.max(1, canvas.width));
  const preview = document.createElement("canvas");
  preview.width = Math.max(1, Math.round(canvas.width * ratio));
  preview.height = Math.max(1, Math.round(canvas.height * ratio));
  const context = preview.getContext("2d");
  if (!context) return canvas.toDataURL("image/jpeg", 0.7);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, preview.width, preview.height);
  context.drawImage(canvas, 0, 0, preview.width, preview.height);
  return preview.toDataURL("image/jpeg", 0.72);
};

const waitForPaint = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const openPdf = async (file: Blob): Promise<PDFDocumentProxy> => {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    return await pdfjs.getDocument({
      data,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") {
      throw new Error("El PDF está protegido con contraseña y no se puede convertir.");
    }
    throw new Error("El archivo no pudo leerse como PDF válido.");
  }
};

/** Renders the requested 0-based page indices into image blobs. */
export const renderPdfToImages = async (
  file: Blob,
  options: RenderPdfImagesOptions,
): Promise<RenderedPdfImage[]> => {
  if (!options.pages.length) throw new Error("Selecciona al menos una página para convertir.");
  const format = getPdfImageFormat(options.format);
  const document = await openPdf(file);
  const rendered: RenderedPdfImage[] = [];

  try {
    for (const [index, pageIndex] of options.pages.entries()) {
      const page = await document.getPage(pageIndex + 1);
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = clampPdfRenderScale(base.width, base.height, options.resolutionScale);
        const viewport = page.getViewport({ scale });
        const width = Math.max(1, Math.floor(viewport.width));
        const height = Math.max(1, Math.floor(viewport.height));

        const canvas = documentCanvas(width, height);
        const context = canvas.getContext("2d", { alpha: format.id !== "png" });
        if (!context) throw new Error("Tu navegador no permitió preparar esta página.");

        if (format.id !== "png") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
        }

        await page.render({ canvas, canvasContext: context, viewport }).promise;
        const blob = await canvasToBlob(canvas, format.mime, options.quality / 100);
        rendered.push({
          pageNumber: pageIndex + 1,
          filename: pdfImageFilename(pageIndex + 1, options.format),
          blob,
          previewUrl: buildPreview(canvas),
          width,
          height,
        });
        canvas.width = 1;
        canvas.height = 1;
      } finally {
        page.cleanup();
      }
      options.onProgress?.(index + 1, options.pages.length);
      await waitForPaint();
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }

  return rendered;
};

const documentCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};
