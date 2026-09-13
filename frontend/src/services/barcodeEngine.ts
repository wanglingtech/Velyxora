/**
 * Real Client-Side Code 128 Barcode Generator
 * Generates ISO/IEC 15417 compliant Code 128 barcodes directly onto HTML5 Canvas.
 */

// Code 128 encoding patterns (107 patterns, 11 bits each, stop character is 13 bits)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // Stop code
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export interface BarcodeOptions {
  width?: number; // scale multiplier (default 2)
  height?: number; // bar height in px (default 80)
  includeText?: boolean;
  color?: string;
  bgColor?: string;
}

/**
 * Encodes ASCII text into Code 128B bar sequence
 */
export function encodeCode128B(text: string): number[] {
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 95) {
      throw new Error(`Carácter no soportado en Code 128B: "${text.charAt(i)}"`);
    }
    codes.push(code);
    checksum += code * (i + 1);
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP_CODE);

  return codes;
}

/**
 * Renders Code 128 barcode onto an HTML5 Canvas element
 */
export function renderCode128ToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options: BarcodeOptions = {}
): void {
  const barMultiplier = options.width || 2;
  const barHeight = options.height || 90;
  const includeText = options.includeText !== false;
  const barColor = options.color || '#000000';
  const bgColor = options.bgColor || '#FFFFFF';

  const codes = encodeCode128B(text);

  // Convert pattern codes to array of binary modules (1 for bar, 0 for space)
  const modules: number[] = [];
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c];
    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern.charAt(p), 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  const quietZone = 20 * barMultiplier;
  const totalWidth = modules.length * barMultiplier + quietZone * 2;
  const totalHeight = barHeight + (includeText ? 36 : 20);

  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Draw Bars
  ctx.fillStyle = barColor;
  let currentX = quietZone;
  const startY = 12;

  for (const mod of modules) {
    if (mod === 1) {
      ctx.fillRect(currentX, startY, barMultiplier, barHeight);
    }
    currentX += barMultiplier;
  }

  // Draw human-readable text below barcode
  if (includeText) {
    ctx.fillStyle = barColor;
    ctx.font = `600 ${Math.max(12, Math.round(14 * (barMultiplier / 2)))}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, totalWidth / 2, startY + barHeight + 6);
  }
}

/**
 * Generates downloadable Barcode Blob & Data URL
 */
export async function generateBarcode(
  text: string,
  options: BarcodeOptions = {}
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const canvas = document.createElement('canvas');
  renderCode128ToCanvas(canvas, text, options);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Fallo al exportar código de barras'))), 'image/png');
  });

  return {
    blob,
    dataUrl,
    width: canvas.width,
    height: canvas.height
  };
}
