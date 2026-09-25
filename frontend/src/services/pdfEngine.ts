import JSZip from "jszip";
import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";

export type PdfPageSize = "A4" | "Letter" | "Fit";
export type PdfOrientation = "portrait" | "landscape";

// Client-side safeguards for the PDF manipulation tools.
export const PDF_MERGE_MAX_FILES = 30;
export const PDF_MAX_TOTAL_BYTES = 200 * 1024 * 1024;
export const PDF_MAX_PAGES = 2000;

export interface ImagePdfOptions {
  pageSize?: PdfPageSize;
  orientation?: PdfOrientation;
  margin?: number;
}

export interface TextPdfOptions {
  pageSize?: Exclude<PdfPageSize, "Fit">;
  margin?: number;
  fontSize?: number;
}

const PAGE_SIZES: Record<Exclude<PdfPageSize, "Fit">, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
};

const clampMargin = (
  margin: number | undefined,
  width: number,
  height: number,
): number => {
  const value = Number.isFinite(margin) ? Math.max(0, margin || 0) : 20;
  return Math.min(value, Math.max(0, Math.min(width, height) / 2 - 1));
};

const getPageSize = (
  pageSize: Exclude<PdfPageSize, "Fit">,
  orientation: PdfOrientation,
): [number, number] => {
  const [width, height] = PAGE_SIZES[pageSize];
  return orientation === "landscape" ? [height, width] : [width, height];
};

const blobFromPdf = (bytes: Uint8Array): Blob =>
  new Blob([bytes as BlobPart], { type: "application/pdf" });

const loadWebpAsPng = async (file: File): Promise<Uint8Array> => {
  if (typeof Image === "undefined" || typeof document === "undefined") {
    throw new Error(
      `No se pudo procesar ${file.name}: WebP requiere un entorno de navegador.`,
    );
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(
          new Error(`No se pudo decodificar la imagen WebP ${file.name}.`),
        );
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0 || canvas.height === 0) {
      throw new Error(`No se pudo preparar el lienzo para ${file.name}.`);
    }
    context.drawImage(image, 0, 0);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error(`No se pudo convertir ${file.name} a PNG.`)),
        "image/png",
      );
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
};

const embedImage = async (pdf: PDFDocument, file: File) => {
  const type = file.type.toLowerCase();
  const bytes =
    type === "image/webp"
      ? await loadWebpAsPng(file)
      : new Uint8Array(await file.arrayBuffer());

  try {
    if (type === "image/jpeg" || type === "image/jpg")
      return await pdf.embedJpg(bytes);
    if (type === "image/png" || type === "image/webp")
      return await pdf.embedPng(bytes);
  } catch {
    throw new Error(`No se pudo decodificar la imagen ${file.name}.`);
  }

  throw new Error(
    `Formato no compatible para ${file.name}. Usa JPG, JPEG, PNG o WebP.`,
  );
};

export async function createPdfFromImages(
  files: File[],
  options: ImagePdfOptions = {},
): Promise<Blob> {
  if (files.length === 0)
    throw new Error("Debes proporcionar al menos una imagen.");

  const pdf = await PDFDocument.create();
  for (const file of files) {
    const image = await embedImage(pdf, file);
    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === "Fit") {
      const imageMargin = options.margin ?? 20;
      const scale = 72 / 96;
      pageWidth = Math.max(1, image.width * scale + imageMargin * 2);
      pageHeight = Math.max(1, image.height * scale + imageMargin * 2);
    } else {
      [pageWidth, pageHeight] = getPageSize(
        options.pageSize || "A4",
        options.orientation || "portrait",
      );
    }

    const margin = clampMargin(options.margin, pageWidth, pageHeight);
    const page = pdf.addPage([pageWidth, pageHeight]);
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    const scale = Math.min(
      availableWidth / image.width,
      availableHeight / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    });
  }

  return blobFromPdf(await pdf.save());
}

const wrapText = (
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !line)
        line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
};

async function loadPdfDocument(blob: Blob, label: string): Promise<PDFDocument> {
  if (blob.type && blob.type !== "application/pdf") {
    throw new Error(`${label} no es un PDF válido.`);
  }
  try {
    return await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()), {
      ignoreEncryption: false,
    });
  } catch (error: any) {
    if (/encrypt/i.test(String(error?.message || ""))) {
      throw new Error(`${label} está protegido con contraseña y no puede procesarse.`);
    }
    throw new Error(`${label} no pudo leerse como PDF válido.`);
  }
}

export async function getPdfPageCount(file: Blob, label = "El archivo"): Promise<number> {
  const document = await loadPdfDocument(file, label);
  return document.getPageCount();
}

/**
 * Parses a 1-based page range expression (e.g. "1-3,5,8-") into sorted,
 * unique 0-based indices. Throws on malformed or out-of-bounds input.
 */
export function parsePdfPageRange(input: string, pageCount: number): number[] {
  const clean = input.trim();
  if (!clean) throw new Error("Indica un rango de páginas, por ejemplo 1-3,5.");
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error("El PDF no tiene páginas.");
  const indices = new Set<number>();
  for (const rawToken of clean.split(",")) {
    const token = rawToken.trim();
    if (!token) continue;
    const single = /^(\d+)$/.exec(token);
    const range = /^(\d+)\s*-\s*(\d+)?$/.exec(token);
    const tail = /^-\s*(\d+)$/.exec(token);
    let start: number;
    let end: number;
    if (single) {
      start = end = Number(single[1]);
    } else if (range) {
      start = Number(range[1]);
      end = range[2] ? Number(range[2]) : pageCount;
    } else if (tail) {
      start = 1;
      end = Number(tail[1]);
    } else {
      throw new Error(`Rango de páginas inválido: "${token}".`);
    }
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(`Rango fuera de límites: "${token}" (el PDF tiene ${pageCount} páginas).`);
    }
    for (let page = start; page <= end; page++) indices.add(page - 1);
  }
  if (!indices.size) throw new Error("Indica al menos una página válida.");
  return [...indices].sort((a, b) => a - b);
}

export async function mergePdfs(files: Blob[]): Promise<Blob> {
  if (!files.length) throw new Error("Agrega al menos un PDF para unir.");
  if (files.length > PDF_MERGE_MAX_FILES) {
    throw new Error(`Puedes unir hasta ${PDF_MERGE_MAX_FILES} PDFs a la vez.`);
  }
  const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
  if (totalBytes > PDF_MAX_TOTAL_BYTES) {
    throw new Error("El tamaño total supera el límite permitido de 200 MB.");
  }
  const output = await PDFDocument.create();
  let pages = 0;
  for (const [index, file] of files.entries()) {
    const source = await loadPdfDocument(file, `El archivo ${index + 1}`);
    pages += source.getPageCount();
    if (pages > PDF_MAX_PAGES) {
      throw new Error(`El documento resultante supera el máximo de ${PDF_MAX_PAGES} páginas.`);
    }
    const copied = await output.copyPages(source, source.getPageIndices());
    copied.forEach((page) => output.addPage(page));
  }
  return blobFromPdf(await output.save({ useObjectStreams: true }));
}

export async function extractPdfPages(file: Blob, pageIndices: number[]): Promise<Blob> {
  if (!pageIndices.length) throw new Error("Selecciona al menos una página.");
  const source = await loadPdfDocument(file, "El archivo");
  const pageCount = source.getPageCount();
  if (pageIndices.some((index) => index < 0 || index >= pageCount)) {
    throw new Error("El rango de páginas excede el documento.");
  }
  const output = await PDFDocument.create();
  const copied = await output.copyPages(source, pageIndices);
  copied.forEach((page) => output.addPage(page));
  return blobFromPdf(await output.save({ useObjectStreams: true }));
}

export async function splitPdfIntoZip(file: Blob, baseName = "documento"): Promise<Blob> {
  const source = await loadPdfDocument(file, "El archivo");
  const pageCount = source.getPageCount();
  if (pageCount > PDF_MAX_PAGES) {
    throw new Error(`El documento supera el máximo de ${PDF_MAX_PAGES} páginas.`);
  }
  const safeBase =
    baseName.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "documento";
  const zip = new JSZip();
  for (const index of source.getPageIndices()) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    output.addPage(page);
    zip.file(
      `${safeBase}_pagina_${String(index + 1).padStart(3, "0")}.pdf`,
      await output.save({ useObjectStreams: true }),
    );
  }
  return zip.generateAsync({ type: "blob" });
}

export async function createPdfFromText(
  title: string,
  text: string,
  options: TextPdfOptions = {},
): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [pageWidth, pageHeight] = getPageSize(
    options.pageSize || "A4",
    "portrait",
  );
  const margin = clampMargin(options.margin, pageWidth, pageHeight);
  const fontSize = Math.max(6, options.fontSize || 11);
  const titleSize = Math.max(fontSize, 16);
  const lineHeight = fontSize * 1.4;
  const lines = wrapText(text, font, fontSize, pageWidth - margin * 2);
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  if (title) {
    page.drawText(title, { x: margin, y, size: titleSize, font: boldFont });
    y -= titleSize * 1.5;
  }

  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (line) page.drawText(line, { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  }

  return blobFromPdf(await pdf.save());
}
