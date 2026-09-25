import JSZip from 'jszip';
import QRCode from 'qrcode';

export interface ImageConversionOptions {
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number; // 0.1 to 1.0
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Client-side safety limits for canvas-based image processing.
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_DIMENSION = 16_384;

export type CanvasOutputMime = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Maps a requested MIME to a format the browser can reliably encode via
 * canvas.toBlob. Unsupported inputs (GIF, SVG, BMP, unknown) fall back to PNG.
 */
export function resolveCanvasOutputFormat(requested?: string): { mime: CanvasOutputMime; extension: 'jpg' | 'png' | 'webp' } {
  const value = (requested || '').toLowerCase();
  if (value === 'image/jpeg' || value === 'image/jpg') return { mime: 'image/jpeg', extension: 'jpg' };
  if (value === 'image/webp') return { mime: 'image/webp', extension: 'webp' };
  return { mime: 'image/png', extension: 'png' };
}

/**
 * Validates output dimensions and rejects zero/negative, non-finite, oversized
 * or pixel-heavy targets to avoid unsafe canvas allocations.
 */
export function validateOutputDimensions(width: number, height: number): { width: number; height: number } {
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    throw new Error('Las dimensiones deben ser mayores a 0 píxeles.');
  }
  if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
    throw new Error(`Las dimensiones no pueden superar ${MAX_IMAGE_DIMENSION} px por lado.`);
  }
  if (w * h > MAX_IMAGE_PIXELS) {
    throw new Error('La imagen resultante es demasiado grande para procesarse de forma segura.');
  }
  return { width: w, height: h };
}

/**
 * Loads an image file into an HTMLImageElement safely
 */
export function loadImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo decodificar el archivo de imagen.'));
    };
    img.src = url;
  });
}

/**
 * Real Client-Side Image Converter & Compressor using HTML5 Canvas
 */
export async function convertImage(
  file: File | Blob,
  options: ImageConversionOptions
): Promise<{ blob: Blob; width: number; height: number; filename: string }> {
  const img = await loadImageElement(file);

  const { mime, extension } = resolveCanvasOutputFormat(options.format);
  const { width: targetWidth, height: targetHeight } = validateOutputDimensions(
    options.width || img.naturalWidth,
    options.height || img.naturalHeight,
  );

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto Canvas 2D en tu navegador.');
  }

  // Smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // JPEG has no alpha channel: paint a predictable opaque background first.
  if (mime === 'image/jpeg') {
    ctx.fillStyle = options.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const quality = options.quality !== undefined ? options.quality : 0.92;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Fallo al exportar el buffer de imagen desde Canvas.'));
      },
      mime,
      quality
    );
  });

  const baseName = ('name' in file && file.name) ? file.name.substring(0, file.name.lastIndexOf('.')) || 'image' : 'converted_image';
  const filename = `${baseName}.${extension}`;

  return {
    blob,
    width: targetWidth,
    height: targetHeight,
    filename
  };
}

/**
 * Real Client-Side Image Cropper
 */
export async function cropImage(
  file: File | Blob,
  crop: CropRect,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.95
): Promise<{ blob: Blob; width: number; height: number; filename: string }> {
  const img = await loadImageElement(file);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D no disponible.');
  }

  if (format === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Error al generar recorte'))),
      format,
      quality
    );
  });

  const baseName = ('name' in file && file.name) ? file.name.replace(/\.[^/.]+$/, '') : 'cropped';
  const ext = format === 'image/jpeg' ? 'jpg' : 'png';

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    filename: `${baseName}_cropped.${ext}`
  };
}

/**
 * Real Client-Side Video Frame Extractor using HTML5 Video + Canvas
 */
export async function extractVideoFrame(
  videoFile: File,
  timeInSeconds: number,
  format: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<{ blob: Blob; width: number; height: number; filename: string }> {
  const videoUrl = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.src = videoUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Formato de video no decodificable por el navegador.'));
      setTimeout(() => reject(new Error('Tiempo de espera agotado al cargar el video.')), 8000);
    });

    const targetTime = Math.min(Math.max(0, timeInSeconds), video.duration || 0);
    video.currentTime = targetTime;

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Error buscando el fotograma indicado.'));
      setTimeout(() => reject(new Error('Timeout de búsqueda en video.')), 6000);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Error al preparar canvas de video.');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Error al capturar fotograma.'))),
        format,
        0.95
      );
    });

    const baseName = videoFile.name.replace(/\.[^/.]+$/, '');
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      filename: `${baseName}_frame_${Math.round(targetTime)}s.${ext}`
    };
  } finally {
    URL.revokeObjectURL(videoUrl);
    video.remove();
  }
}

/**
 * Real Client-Side Audio Trimming & WAV PCM Export via Web Audio API
 */
export async function trimAndExportWav(
  audioFile: File,
  startSec: number,
  endSec: number,
  forceMono: boolean = false
): Promise<{ blob: Blob; filename: string; duration: number }> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await audioFile.arrayBuffer();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const duration = decodedBuffer.duration;
  const start = Math.max(0, Math.min(startSec, duration));
  const end = Math.min(Math.max(start, endSec), duration);
  const sliceDuration = end - start;

  if (sliceDuration <= 0) {
    throw new Error('El rango de recorte debe ser mayor a 0 segundos.');
  }

  const sampleRate = decodedBuffer.sampleRate;
  const startOffset = Math.floor(start * sampleRate);
  const endOffset = Math.floor(end * sampleRate);
  const frameCount = endOffset - startOffset;

  const numChannels = forceMono ? 1 : Math.min(decodedBuffer.numberOfChannels, 2);

  // Encode to 16-bit PCM WAV
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  if (numChannels === 1) {
    // Mono: blend or copy channel 0
    const ch0 = decodedBuffer.getChannelData(0);
    const ch1 = decodedBuffer.numberOfChannels > 1 ? decodedBuffer.getChannelData(1) : ch0;
    for (let i = 0; i < frameCount; i++) {
      const sample = (ch0[startOffset + i] + ch1[startOffset + i]) / 2;
      const s = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  } else {
    // Stereo
    const left = decodedBuffer.getChannelData(0);
    const right = decodedBuffer.numberOfChannels > 1 ? decodedBuffer.getChannelData(1) : left;
    for (let i = 0; i < frameCount; i++) {
      const sL = Math.max(-1, Math.min(1, left[startOffset + i]));
      const sR = Math.max(-1, Math.min(1, right[startOffset + i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
      view.setInt16(offset + 2, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
      offset += 4;
    }
  }

  await audioContext.close();

  const blob = new Blob([view], { type: 'audio/wav' });
  const baseName = ('name' in audioFile && audioFile.name) ? audioFile.name.replace(/\.[^/.]+$/, '') : 'audio';
  return {
    blob,
    filename: `${baseName}_trimmed.wav`,
    duration: sliceDuration
  };
}

/**
 * Extract full audio track from any video or audio file
 */
export async function extractFullAudioTrack(
  mediaFile: File,
  forceMono: boolean = false
): Promise<{ blob: Blob; filename: string; duration: number }> {
  const res = await trimAndExportWav(mediaFile, 0, 99999999, forceMono);
  const baseName = mediaFile.name.replace(/\.[^/.]+$/, '');
  return {
    ...res,
    filename: `${baseName}_audio.wav`
  };
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generates real Favicon package in ZIP format
 */
export async function generateFaviconPackage(imageFile: File): Promise<{ blob: Blob; filename: string }> {
  const sizes = [16, 32, 48, 180];
  const zip = new JSZip();

  for (const size of sizes) {
    const res = await convertImage(imageFile, {
      format: 'image/png',
      width: size,
      height: size,
      quality: 1.0
    });
    const filename = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
    zip.file(filename, res.blob);
  }

  // Add standard index.html snippet
  const htmlSnippet = `<!-- Favicon configuration generated by VELYXORA -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
`;
  zip.file('README-FAVICON.html', htmlSnippet);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return {
    blob: zipBlob,
    filename: `velyxora-favicons-${Date.now()}.zip`
  };
}

/**
 * Generates a real ZIP file from an array of processed items
 */
export async function generateBatchZip(
  files: Array<{ blob: Blob; filename: string }>
): Promise<Blob> {
  const zip = new JSZip();
  files.forEach((f) => {
    zip.file(f.filename, f.blob);
  });
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Real QR Code Generator using QRCode library
 */
export async function generateQrCode(
  data: string,
  options: {
    color?: string;
    bgColor?: string;
    width?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): Promise<{ dataUrl: string; blob: Blob }> {
  const width = options.width || 400;
  const color = options.color || '#000000';
  const bgColor = options.bgColor || '#FFFFFF';

  const dataUrl = await QRCode.toDataURL(data, {
    width,
    margin: 2,
    color: {
      dark: color,
      light: bgColor
    },
    errorCorrectionLevel: options.errorCorrectionLevel || 'M'
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();

  return { dataUrl, blob };
}

/**
 * Real SVG to PNG/JPEG rasterizer with scaling
 */
export async function renderSvgToRaster(
  svgFileOrText: File | string,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  scale: number = 2,
  options: { width?: number; height?: number; background?: string } = {}
): Promise<{ blob: Blob; filename: string; width: number; height: number }> {
  let svgText = '';
  let baseName = 'vector';
  if (typeof svgFileOrText === 'string') {
    svgText = svgFileOrText;
  } else {
    svgText = await svgFileOrText.text();
    baseName = svgFileOrText.name.replace(/\.[^/.]+$/, '');
  }

  // Create an SVG blob URL
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = Math.max(1, Math.round((options.width || img.naturalWidth || 512) * scale));
      const height = Math.max(1, Math.round((options.height || img.naturalHeight || 512) * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      if (format === 'image/jpeg' || options.background) {
        ctx.fillStyle = options.background || '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to export rasterized SVG'));
            return;
          }
          const ext = format === 'image/jpeg' ? 'jpg' : 'png';
          resolve({
            blob,
            filename: `${baseName}_${scale}x.${ext}`,
            width,
            height
          });
        },
        format,
        0.95
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not parse or render SVG file'));
    };
    img.src = url;
  });
}

/**
 * Extract Dominant Colors & Palette from an Image
 */
export async function extractDominantColors(
  file: File | Blob,
  maxColors: number = 8
): Promise<Array<{ hex: string; rgb: string; count: number; percentage: number }>> {
  const img = await loadImageElement(file);
  const canvas = document.createElement('canvas');
  // Downscale for fast analysis
  const size = 100;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  const colorBuckets: Record<string, number> = {};
  let totalValidPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Ignore transparent pixels
    if (a < 128) continue;

    // Quantize colors to groups of 24
    const qR = Math.round(r / 24) * 24;
    const qG = Math.round(g / 24) * 24;
    const qB = Math.round(b / 24) * 24;
    const key = `${Math.min(255, qR)},${Math.min(255, qG)},${Math.min(255, qB)}`;

    colorBuckets[key] = (colorBuckets[key] || 0) + 1;
    totalValidPixels++;
  }

  const sorted = Object.entries(colorBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors);

  return sorted.map(([rgbStr, count]) => {
    const [r, g, b] = rgbStr.split(',').map(Number);
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    return {
      hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      count,
      percentage: totalValidPixels > 0 ? Math.round((count / totalValidPixels) * 100) : 0
    };
  });
}

/**
 * Photographic Filters (Brightness, Contrast, Saturation, Sepia, Grayscale, Invert, Blur)
 */
export interface ImageFilterOptions {
  brightness?: number; // 0 to 200 (100 is default)
  contrast?: number; // 0 to 200 (100 is default)
  saturation?: number; // 0 to 200 (100 is default)
  grayscale?: number; // 0 to 100 (0 default)
  sepia?: number; // 0 to 100 (0 default)
  invert?: number; // 0 to 100 (0 default)
  blur?: number; // 0 to 20 px (0 default)
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export async function applyImageFilters(
  file: File | Blob,
  filters: ImageFilterOptions
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImageElement(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const filterStrings: string[] = [];
  if (filters.brightness !== undefined && filters.brightness !== 100) filterStrings.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== undefined && filters.contrast !== 100) filterStrings.push(`contrast(${filters.contrast}%)`);
  if (filters.saturation !== undefined && filters.saturation !== 100) filterStrings.push(`saturate(${filters.saturation}%)`);
  if (filters.grayscale && filters.grayscale > 0) filterStrings.push(`grayscale(${filters.grayscale}%)`);
  if (filters.sepia && filters.sepia > 0) filterStrings.push(`sepia(${filters.sepia}%)`);
  if (filters.invert && filters.invert > 0) filterStrings.push(`invert(${filters.invert}%)`);
  if (filters.blur && filters.blur > 0) filterStrings.push(`blur(${filters.blur}px)`);

  ctx.filter = filterStrings.length > 0 ? filterStrings.join(' ') : 'none';

  const format = filters.format || 'image/jpeg';
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export filtered image'))), format, 0.95);
  });

  const baseName = ('name' in file && file.name) ? file.name.replace(/\.[^/.]+$/, '') : 'filtered_image';
  const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';

  return {
    blob,
    filename: `${baseName}_filtered.${ext}`
  };
}

/**
 * Add Watermark to Image
 */
export async function applyWatermark(
  file: File | Blob,
  options: {
    text: string;
    opacity?: number;
    color?: string;
    fontSize?: number;
    position?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  }
): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImageElement(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0);

  const text = options.text || 'VELYXORA';
  const opacity = options.opacity !== undefined ? options.opacity : 0.7;
  const color = options.color || '#FFFFFF';
  const fontSize = options.fontSize || Math.max(18, Math.round(canvas.width / 25));
  const pos = options.position || 'bottom-right';

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  const margin = Math.round(canvas.width * 0.04);
  const textMetrics = ctx.measureText(text);

  let x = canvas.width - textMetrics.width - margin;
  let y = canvas.height - margin;

  if (pos === 'center') {
    ctx.textAlign = 'center';
    x = canvas.width / 2;
    y = canvas.height / 2;
  } else if (pos === 'top-left') {
    ctx.textAlign = 'left';
    x = margin;
    y = margin + fontSize;
  } else if (pos === 'top-right') {
    ctx.textAlign = 'right';
    x = canvas.width - margin;
    y = margin + fontSize;
  } else if (pos === 'bottom-left') {
    ctx.textAlign = 'left';
    x = margin;
    y = canvas.height - margin;
  } else {
    // bottom-right
    ctx.textAlign = 'right';
    x = canvas.width - margin;
    y = canvas.height - margin;
  }

  ctx.fillText(text, x, y);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export watermarked image'))), 'image/jpeg', 0.95);
  });

  const baseName = ('name' in file && file.name) ? file.name.replace(/\.[^/.]+$/, '') : 'watermarked';
  return {
    blob,
    filename: `${baseName}_watermark.jpg`
  };
}

/**
 * Inspect Video File Metadata (Resolution, Duration, Aspect Ratio, Bitrate estimation)
 */
export async function inspectVideoMetadata(videoFile: File): Promise<{
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  aspectRatioDecimal: number;
  mimeType: string;
  size: number;
  estimatedBitrateKbps: number;
}> {
  const url = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = url;

  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const w = video.videoWidth || 0;
      const h = video.videoHeight || 0;
      const duration = video.duration || 0;

      // Calculate simplified aspect ratio (e.g. 16:9, 4:3, 1:1)
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(w, h);
      const aspectStr = divisor > 0 ? `${w / divisor}:${h / divisor}` : `${w}:${h}`;
      const aspectDec = h > 0 ? Number((w / h).toFixed(2)) : 1;

      // Bitrate estimation in kbps: (size_in_bits / duration_in_seconds) / 1000
      const bitrateKbps = duration > 0 ? Math.round((videoFile.size * 8) / duration / 1000) : 0;

      resolve({
        duration,
        width: w,
        height: h,
        aspectRatio: aspectStr,
        aspectRatioDecimal: aspectDec,
        mimeType: videoFile.type || 'video/mp4',
        size: videoFile.size,
        estimatedBitrateKbps: bitrateKbps
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo inspeccionar el archivo de video'));
    };
  });
}
