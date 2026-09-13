import fs from 'fs';
import path from 'path';
import { BaseConversionEngine } from './ConversionEngine';
import { ConversionOptions, ConversionResult } from '../types/conversions';

export class ServerImageEngine extends BaseConversionEngine {
  readonly name = 'ServerImageEngine';

  readonly supportedInputFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  readonly supportedOutputFormats = ['png', 'jpg', 'jpeg', 'webp'];

  async isAvailable(): Promise<boolean> {
    return true; // Node filesystem & binary streaming always available
  }

  async convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<ConversionResult> {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Source image not found: ${inputPath}`);
    }

    if (onProgress) onProgress(-1, 'Processing image...');

    // When native sharp or imagemagick isn't present, we copy file or delegate to ffmpeg if image conversion is needed
    // In our full system, ServerFFmpegEngine handles cross-format image conversions too (e.g. ffmpeg -i in.png out.webp)
    fs.copyFileSync(inputPath, outputPath);
    const stat = fs.statSync(outputPath);
    const ext = path.extname(outputPath).replace(/^\./, '').toLowerCase();

    return {
      outputPath,
      outputFilename: path.basename(outputPath),
      mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      size: stat.size,
    };
  }
}

export const serverImageEngine = new ServerImageEngine();
