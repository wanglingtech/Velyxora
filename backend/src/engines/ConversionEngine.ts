import { ConversionOptions, ConversionResult } from '../types/conversions';

export interface IConversionEngine {
  readonly name: string;
  readonly supportedInputFormats: string[];
  readonly supportedOutputFormats: string[];
  isAvailable(): Promise<boolean>;
  canHandle(inputFormat: string, outputFormat: string): boolean;
  convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    onProgress?: (progress: number, message?: string) => void,
    signal?: AbortSignal,
  ): Promise<ConversionResult>;
}

export abstract class BaseConversionEngine implements IConversionEngine {
  abstract readonly name: string;
  abstract readonly supportedInputFormats: string[];
  abstract readonly supportedOutputFormats: string[];

  abstract isAvailable(): Promise<boolean>;

  canHandle(inputFormat: string, outputFormat: string): boolean {
    const inFmt = inputFormat.toLowerCase().replace(/^\./, '');
    const outFmt = outputFormat.toLowerCase().replace(/^\./, '');
    return this.supportedInputFormats.includes(inFmt) && this.supportedOutputFormats.includes(outFmt);
  }

  abstract convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    onProgress?: (progress: number, message?: string) => void,
    signal?: AbortSignal,
  ): Promise<ConversionResult>;
}
