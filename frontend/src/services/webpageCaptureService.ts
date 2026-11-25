/**
 * Client-side webpage capture engine.
 *
 * An arbitrary page cannot be screenshotted directly from the browser, so the
 * page is rendered inside a same-origin preview iframe and serialized into an
 * SVG <foreignObject>. Computed styles are inlined, referenced images are
 * loaded through the backend asset proxy and embedded as data URLs, and the
 * result is rasterized per vertical segment. Complex pages (canvas, video,
 * cross-origin web fonts) may render simplified, which the UI states clearly.
 */

import { apiClient } from "./apiClient";

export type CaptureImageFormat = "image/png" | "image/jpeg" | "image/webp";

export const CAPTURE_SEGMENT_HEIGHT = 1400;
export const MAX_CAPTURE_SEGMENTS = 24;
export const MAX_CAPTURE_ELEMENTS = 3000;
export const MAX_CAPTURE_DIMENSION = 5000;

export interface CaptureSegmentPlan {
  index: number;
  top: number;
  height: number;
}

export interface CapturedSegment {
  id: string;
  index: number;
  top: number;
  width: number;
  height: number;
  blob: Blob;
  dataUrl: string;
  blank: boolean;
}

export interface CaptureOptions {
  document: Document;
  baseUrl: string;
  format: CaptureImageFormat;
  quality: number;
  scale: number;
  segmentHeight?: number;
  maxSegments?: number;
  onProgress?: (done: number, total: number) => void;
}

export class WebpageCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebpageCaptureError";
  }
}

/** Splits a page into vertical slices, respecting the hard segment cap. */
export const computeCaptureSegments = (
  totalHeight: number,
  segmentHeight = CAPTURE_SEGMENT_HEIGHT,
  maxSegments = MAX_CAPTURE_SEGMENTS,
): CaptureSegmentPlan[] => {
  const height = Math.max(1, Math.floor(totalHeight));
  const slice = Math.max(200, Math.floor(segmentHeight));
  const count = Math.min(maxSegments, Math.max(1, Math.ceil(height / slice)));
  return Array.from({ length: count }, (_, index) => {
    const top = index * slice;
    return { index, top, height: Math.min(slice, height - top) };
  }).filter((segment) => segment.height > 0);
};

/** A screenshot is "blank" when its downscaled pixels contain one flat color. */
export const isMostlyBlankPixels = (data: Uint8ClampedArray): boolean => {
  if (data.length < 4) return true;
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;
  let minA = 255;
  let maxA = 0;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  return maxR - minR <= 10 && maxG - minG <= 10 && maxB - minB <= 10 && maxA - minA <= 10;
};

export const captureFilename = (index: number, format: CaptureImageFormat): string => {
  const extension = format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";
  return `pagina-${String(index + 1).padStart(2, "0")}.${extension}`;
};

const STYLE_PROPERTIES = [
  "display", "position", "top", "right", "bottom", "left", "float", "clear", "z-index",
  "width", "height", "min-width", "min-height", "max-width", "max-height", "box-sizing",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "overflow", "overflow-x", "overflow-y", "opacity", "visibility",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "justify-content", "align-items", "align-content", "align-self", "order", "gap", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-auto-flow", "grid-column", "grid-row",
  "font-family", "font-size", "font-weight", "font-style", "font-variant", "line-height",
  "letter-spacing", "word-spacing", "text-align", "text-transform", "text-indent",
  "text-decoration-line", "text-decoration-color", "text-decoration-style", "white-space",
  "word-break", "overflow-wrap", "vertical-align", "color",
  "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "background-clip", "background-origin", "background-attachment",
  "box-shadow", "text-shadow", "transform", "transform-origin", "filter", "clip-path",
  "list-style-type", "list-style-position", "list-style-image",
  "border-collapse", "border-spacing", "table-layout",
  "object-fit", "object-position", "aspect-ratio",
  "column-count", "column-gap", "column-width",
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const CAPTURE_RENDER_TIMEOUT_MS = 20_000;
const CAPTURE_BLOB_TIMEOUT_MS = 25_000;

const withCaptureTimeout = async <T>(task: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new WebpageCaptureError(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const waitForResources = async (doc: Document): Promise<void> => {
  try {
    await Promise.race([doc.fonts?.ready ?? Promise.resolve(), sleep(2500)]);
  } catch {
    // Font loading failures must not block the capture.
  }
  const images = Array.from(doc.images ?? []);
  await Promise.race([
    Promise.all(images.map((image) => (image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    })))),
    sleep(4000),
  ]);
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer una imagen de la página."));
    reader.readAsDataURL(blob);
  });

const buildAssetLoader = (baseUrl: string) => {
  const cache = new Map<string, Promise<string | null>>();
  return (rawUrl: string): Promise<string | null> => {
    let absolute: string;
    try {
      absolute = new URL(rawUrl, baseUrl).toString();
    } catch {
      return Promise.resolve(null);
    }
    if (absolute.startsWith("data:")) return Promise.resolve(absolute);
    if (!cache.has(absolute)) {
      cache.set(
        absolute,
        apiClient
          .fetchWebpageAsset(absolute)
          .then(blobToDataUrl)
          .catch(() => null),
      );
    }
    return cache.get(absolute)!;
  };
};

const collectBackgroundUrls = (computed: CSSStyleDeclaration): string[] => {
  const value = computed.getPropertyValue("background-image");
  if (!value || value === "none") return [];
  return Array.from(value.matchAll(/url\((['"]?)(.*?)\1\)/g)).map((match) => match[2]);
};

const replaceUrls = async (
  value: string,
  loadAsset: (url: string) => Promise<string | null>,
): Promise<string> => {
  const matches = Array.from(value.matchAll(/url\((['"]?)(.*?)\1\)/g));
  let result = value;
  for (const match of matches) {
    const raw = match[2];
    const dataUrl = raw.startsWith("data:") ? raw : await loadAsset(raw);
    if (dataUrl) result = result.split(match[0]).join(`url("${dataUrl}")`);
  }
  return result;
};

const copyComputedStyles = async (
  source: Element,
  target: Element,
  win: Window,
  loadAsset: (url: string) => Promise<string | null>,
): Promise<void> => {
  const computed = win.getComputedStyle(source);
  for (const property of STYLE_PROPERTIES) {
    const value = computed.getPropertyValue(property);
    if (!value) continue;
    if (property === "background-image" && value.includes("url(")) {
      target.setAttribute("data-style-background", "pending");
      const replaced = await replaceUrls(value, loadAsset);
      target.setAttribute("style", `${target.getAttribute("style") || ""};${property}:${replaced}`);
      target.removeAttribute("data-style-background");
      continue;
    }
    target.setAttribute("style", `${target.getAttribute("style") || ""};${property}:${value}`);
  }
};

const buildSvgMarkup = (
  innerHtml: string,
  bodyStyle: string,
  pageWidth: number,
  pageHeight: number,
  segmentHeight: number,
  offset: number,
  background: string,
): string => {
  const width = Math.ceil(pageWidth);
  const height = Math.ceil(segmentHeight);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject x="0" y="0" width="${width}" height="${height}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;background:${background};">
        <div style="width:${width}px;height:${Math.ceil(pageHeight)}px;transform:translateY(${-Math.round(offset)}px);transform-origin:top left;${bodyStyle}">${innerHtml}</div>
      </div>
    </foreignObject>
  </svg>`;
};

const renderSvgToCanvas = async (
  markup: string,
  width: number,
  height: number,
  scale: number,
): Promise<HTMLCanvasElement> => {
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.decoding = "async";
    await withCaptureTimeout(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new WebpageCaptureError("La página no se pudo convertir en imagen. Prueba con otra URL o con menos contenido."));
        image.src = url;
      }),
      CAPTURE_RENDER_TIMEOUT_MS,
      "La captura tardó demasiado en prepararse. Prueba con una página más sencilla.",
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new WebpageCaptureError("Tu navegador no permitió preparar la captura.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = (canvas: HTMLCanvasElement, format: CaptureImageFormat, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new WebpageCaptureError("No se pudo generar la imagen de esta pantalla."))),
      format,
      format === "image/png" ? undefined : quality,
    );
  });

const canvasIsBlank = (canvas: HTMLCanvasElement): boolean => {
  const sample = document.createElement("canvas");
  sample.width = 64;
  sample.height = 64;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  return isMostlyBlankPixels(context.getImageData(0, 0, sample.width, sample.height).data);
};

export const captureWebpage = async (options: CaptureOptions): Promise<CapturedSegment[]> => {
  const { document: doc, baseUrl, format, quality, scale } = options;
  const body = doc.body;
  if (!body) throw new WebpageCaptureError("La página no tiene contenido visible para capturar.");

  const elementCount = body.getElementsByTagName("*").length;
  if (elementCount > MAX_CAPTURE_ELEMENTS) {
    throw new WebpageCaptureError(
      `La página tiene demasiados elementos (${elementCount}). Prueba con una página más sencilla.`,
    );
  }

  await waitForResources(doc);

  const root = doc.documentElement;
  const pageWidth = Math.min(
    MAX_CAPTURE_DIMENSION,
    Math.max(320, root.scrollWidth, body.scrollWidth),
  );
  const pageHeight = Math.min(
    MAX_CAPTURE_DIMENSION * 2,
    Math.max(200, root.scrollHeight, body.scrollHeight),
  );
  const plans = computeCaptureSegments(
    pageHeight,
    options.segmentHeight ?? CAPTURE_SEGMENT_HEIGHT,
    options.maxSegments ?? MAX_CAPTURE_SEGMENTS,
  );
  if (!plans.length) throw new WebpageCaptureError("La página no tiene altura suficiente para capturarse.");

  const win = doc.defaultView;
  if (!win) throw new WebpageCaptureError("No se pudo acceder al contenido de la página.");

  const loadAsset = buildAssetLoader(baseUrl);
  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script,noscript").forEach((node) => node.remove());

  const sourceElements: Element[] = [body];
  const cloneElements: Element[] = [clone];
  const sourceWalker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  const cloneWalker = doc.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  let sourceNode = sourceWalker.nextNode();
  let cloneNode = cloneWalker.nextNode();
  while (sourceNode && cloneNode) {
    sourceElements.push(sourceNode as Element);
    cloneElements.push(cloneNode as Element);
    sourceNode = sourceWalker.nextNode();
    cloneNode = cloneWalker.nextNode();
  }

  // Prefetch referenced images once so each style copy can reuse the cache.
  for (const source of sourceElements) {
    const computed = win.getComputedStyle(source);
    await Promise.all(collectBackgroundUrls(computed).map((url) => loadAsset(url)));
  }
  await Promise.all(
    Array.from(clone.querySelectorAll("img")).map(async (image) => {
      const src = image.getAttribute("src");
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await loadAsset(src);
      if (dataUrl) image.setAttribute("src", dataUrl);
      else image.removeAttribute("src");
    }),
  );

  for (let index = 0; index < sourceElements.length; index += 1) {
    await copyComputedStyles(sourceElements[index], cloneElements[index], win, loadAsset);
  }

  const bodyComputed = win.getComputedStyle(body);
  const bodyStyle = [
    `font-family:${bodyComputed.fontFamily}`,
    `font-size:${bodyComputed.fontSize}`,
    `line-height:${bodyComputed.lineHeight}`,
    `color:${bodyComputed.color}`,
    `background-color:${bodyComputed.backgroundColor}`,
    `padding:${bodyComputed.padding}`,
    `margin:${bodyComputed.margin}`,
  ].join(";");
  const background = bodyComputed.backgroundColor && bodyComputed.backgroundColor !== "rgba(0, 0, 0, 0)"
    ? bodyComputed.backgroundColor
    : "#ffffff";
  const innerHtml = new XMLSerializer().serializeToString(clone);
  const fragment = innerHtml.replace(/^<body[^>]*>/i, "").replace(/<\/body>$/i, "");
  const captured: CapturedSegment[] = [];

  const effectiveScale = Math.min(
    Math.max(0.5, scale),
    MAX_CAPTURE_DIMENSION / pageWidth,
    MAX_CAPTURE_DIMENSION / Math.max(...plans.map((plan) => plan.height)),
  );

  for (const plan of plans) {
    const markup = buildSvgMarkup(
      fragment,
      bodyStyle,
      pageWidth,
      pageHeight,
      plan.height,
      plan.top,
      background,
    );
    const canvas = await renderSvgToCanvas(markup, pageWidth, plan.height, effectiveScale);
    const blob = await canvasToBlob(canvas, format, quality);
    captured.push({
      id: `capture-${plan.index}-${Date.now()}`,
      index: plan.index,
      top: plan.top,
      width: canvas.width,
      height: canvas.height,
      blob,
      dataUrl: await blobToDataUrl(blob),
      blank: canvasIsBlank(canvas),
    });
    options.onProgress?.(captured.length, plans.length);
    await sleep(0);
  }

  return captured;
};

/* -------------------------------------------------------------------------- */
/* Server-rendered full-page capture                                           */
/* -------------------------------------------------------------------------- */

export interface BrowserCaptureOptions {
  url: string;
  width: number;
  format: CaptureImageFormat;
  quality: number;
  scale: number;
  segmentHeight?: number;
  maxSegments?: number;
  onProgress?: (done: number, total: number) => void;
}

interface LoadedCaptureImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

const loadCaptureImage = async (blob: Blob): Promise<LoadedCaptureImage> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Older browsers fall back to an HTMLImageElement below.
    }
  }

  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "sync";
  try {
    await withCaptureTimeout(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new WebpageCaptureError("La captura del servidor no se pudo leer."));
        image.src = url;
      }),
      CAPTURE_RENDER_TIMEOUT_MS,
      "La captura del servidor tardó demasiado en abrirse.",
    );
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
};

/**
 * Splits the full-page image produced by the server into the same vertical
 * screens the basic capture generates, so previews, ZIP and PDF exports keep
 * working unchanged.
 */
export const sliceCapturedImage = async (
  blob: Blob,
  options: {
    pageWidth: number;
    pageHeight: number;
    format: CaptureImageFormat;
    quality: number;
    segmentHeight?: number;
    maxSegments?: number;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<CapturedSegment[]> => {
  const loaded = await loadCaptureImage(blob);
  try {
    if (!loaded.width || !loaded.height) {
      throw new WebpageCaptureError("La captura del servidor llegó vacía.");
    }
    const pageHeight = Math.max(1, Math.round(options.pageHeight || loaded.height));
    const ratioY = loaded.height / pageHeight;
    const plans = computeCaptureSegments(
      pageHeight,
      options.segmentHeight ?? CAPTURE_SEGMENT_HEIGHT,
      options.maxSegments ?? MAX_CAPTURE_SEGMENTS,
    ).filter((plan) => Math.round(plan.top * ratioY) < loaded.height);

    const captured: CapturedSegment[] = [];
    for (const plan of plans) {
      const sourceY = Math.min(loaded.height - 1, Math.round(plan.top * ratioY));
      const sourceHeight = Math.max(
        1,
        Math.min(loaded.height - sourceY, Math.round(plan.height * ratioY)),
      );
      const canvas = document.createElement("canvas");
      canvas.width = loaded.width;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new WebpageCaptureError("Tu navegador no permitió preparar la captura.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        loaded.source,
        0,
        sourceY,
        loaded.width,
        sourceHeight,
        0,
        0,
        loaded.width,
        sourceHeight,
      );

      const segmentBlob = await withCaptureTimeout(
        canvasToBlob(canvas, options.format, options.quality),
        CAPTURE_BLOB_TIMEOUT_MS,
        "No se pudo generar la imagen de esta pantalla.",
      );
      captured.push({
        id: `capture-${plan.index}-${Date.now()}`,
        index: plan.index,
        top: plan.top,
        width: canvas.width,
        height: canvas.height,
        blob: segmentBlob,
        dataUrl: await blobToDataUrl(segmentBlob),
        blank: canvasIsBlank(canvas),
      });
      options.onProgress?.(captured.length, plans.length);
      await sleep(0);
    }

    if (!captured.length) {
      throw new WebpageCaptureError("La captura del servidor no contiene pantallas.");
    }
    return captured;
  } finally {
    loaded.release();
  }
};

/** Full-page capture through the server's optional browser engine. */
export const captureWebpageWithBrowser = async (
  options: BrowserCaptureOptions,
): Promise<CapturedSegment[]> => {
  const page = await apiClient.captureWebpagePage({
    url: options.url,
    width: options.width,
    scale: options.scale,
  });
  return sliceCapturedImage(page.blob, {
    pageWidth: page.pageWidth,
    pageHeight: page.pageHeight,
    format: options.format,
    quality: options.quality,
    segmentHeight: options.segmentHeight,
    maxSegments: options.maxSegments,
    onProgress: options.onProgress,
  });
};

/**
 * True when the basic preview is only the HTML shell of a JavaScript app: very
 * little text and no meaningful media. Used to explain the difference between
 * the basic preview and the full capture.
 */
export const pageLooksScriptDriven = (doc: Document): boolean => {
  const body = doc.body;
  if (!body) return true;
  const text = (body.innerText || body.textContent || "").replace(/\s+/g, " ").trim();
  const media = body.querySelectorAll("img,canvas,video,svg,iframe").length;
  const elements = body.getElementsByTagName("*").length;
  return text.length < 240 && media < 3 && elements < 120;
};

