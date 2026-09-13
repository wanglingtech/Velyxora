import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";

export type PdfPageSize = "A4" | "Letter" | "Fit";
export type PdfOrientation = "portrait" | "landscape";

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
