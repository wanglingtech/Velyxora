import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { BaseConversionEngine } from "./ConversionEngine";
import { ConversionOptions, ConversionResult } from "../types/conversions";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

const OFFICE_INPUTS = ["docx", "xlsx", "pptx", "odt", "ods", "odp"];

export class LibreOfficeEngine extends BaseConversionEngine {
  readonly name = "LibreOfficeEngine";
  readonly supportedInputFormats = OFFICE_INPUTS;
  readonly supportedOutputFormats = ["pdf"];
  private availableCache: boolean | null = null;
  private versionCache: string | null = null;

  get executablePath(): string { return this.resolveExecutable(); }
  get version(): string | null { return this.versionCache; }

  async isAvailable(force = false): Promise<boolean> {
    if (!force && this.availableCache !== null) return this.availableCache;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let stdout = "";
      const finish = (available: boolean) => {
        if (settled) return;
        settled = true;
        this.availableCache = available;
        resolve(available);
      };
      let proc: ChildProcess;
      try { proc = spawn(this.resolveExecutable(), ["--headless", "--version"], { windowsHide: true, shell: false }); }
      catch { finish(false); return; }
      const timer = setTimeout(() => { proc.kill(); finish(false); }, 5_000);
      proc.stdout?.on("data", (data) => { stdout += data.toString(); });
      proc.once("error", () => { clearTimeout(timer); finish(false); });
      proc.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) this.versionCache = stdout.trim() || null;
        finish(code === 0);
      });
    });
  }

  async convert(inputPath: string, outputPath: string, _options: ConversionOptions, onProgress?: (progress: number, message?: string) => void, signal?: AbortSignal): Promise<ConversionResult> {
    if (!(await this.isAvailable())) throw new Error("LIBREOFFICE_UNAVAILABLE");
    if (!fs.existsSync(inputPath)) throw new Error("DOCUMENT_INVALID");
    const inputFormat = path.extname(inputPath).slice(1).toLowerCase();
    const targetFormat = path.extname(outputPath).slice(1).toLowerCase();
    if (!this.canHandle(inputFormat, targetFormat)) throw new Error("DOCUMENT_FORMAT_UNSUPPORTED");

    const outDir = path.dirname(outputPath);
    fs.mkdirSync(outDir, { recursive: true });
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "velyxora-lo-"));
    const generatedFile = path.join(outDir, `${path.parse(inputPath).name}.pdf`);
    const args = [`-env:UserInstallation=${pathToFileURL(profileDir).href}`, "--headless", "--nologo", "--nodefault", "--nofirststartwizard", "--convert-to", "pdf", "--outdir", outDir, inputPath];
    onProgress?.(-1, "Convirtiendo documento con LibreOffice...");

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let stderr = "";
        const proc = spawn(this.resolveExecutable(), args, { windowsHide: true, shell: false });
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          if (error) reject(error);
          else resolve();
        };
        const abort = () => { proc.kill(); finish(new Error("CONVERSION_CANCELLED")); };
        const timer = setTimeout(() => { proc.kill(); finish(new Error("LIBREOFFICE_TIMEOUT")); }, ENV.LIBREOFFICE_TIMEOUT_MS);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) return abort();
        proc.stderr?.on("data", (data) => { stderr = (stderr + data.toString()).slice(-4000); });
        proc.once("error", (error) => finish(error));
        proc.once("close", (code) => {
          if (settled) return;
          if (code !== 0) { logger.error(`LibreOffice failed (${code}): ${stderr}`); finish(new Error("DOCUMENT_CONVERSION_FAILED")); }
          else finish();
        });
      });
      if (!fs.existsSync(generatedFile)) throw new Error("DOCUMENT_INVALID");
      if (path.resolve(generatedFile) !== path.resolve(outputPath)) fs.renameSync(generatedFile, outputPath);
      this.validatePdf(outputPath);
      const stat = fs.statSync(outputPath);
      return { outputPath, outputFilename: path.basename(outputPath), mimeType: "application/pdf", size: stat.size };
    } finally { fs.rmSync(profileDir, { recursive: true, force: true }); }
  }

  private validatePdf(filePath: string): void {
    const stat = fs.statSync(filePath);
    if (stat.size < 8 || path.extname(filePath).toLowerCase() !== ".pdf") throw new Error("PDF_VALIDATION_FAILED");
    const fd = fs.openSync(filePath, "r");
    try {
      const head = Buffer.alloc(5);
      fs.readSync(fd, head, 0, head.length, 0);
      const tailSize = Math.min(2048, stat.size);
      const tail = Buffer.alloc(tailSize);
      fs.readSync(fd, tail, 0, tailSize, stat.size - tailSize);
      if (head.toString("ascii") !== "%PDF-" || !tail.toString("latin1").includes("%%EOF")) throw new Error("PDF_VALIDATION_FAILED");
    } finally { fs.closeSync(fd); }
  }

  private resolveExecutable(): string {
    if (process.platform === "win32" && ENV.LIBREOFFICE_PATH.toLowerCase().endsWith("soffice.exe")) {
      const consoleBinary = ENV.LIBREOFFICE_PATH.slice(0, -3) + "com";
      if (fs.existsSync(consoleBinary)) return consoleBinary;
    }
    return ENV.LIBREOFFICE_PATH;
  }
}

export const libreOfficeEngine = new LibreOfficeEngine();
