import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { BaseConversionEngine } from "./ConversionEngine";
import { ConversionOptions, ConversionResult } from "../types/conversions";
import { ENV } from "../config/env";
import { logger } from "../utils/logger";

export class ServerFFmpegEngine extends BaseConversionEngine {
  readonly name = "ServerFFmpegEngine";

  readonly supportedInputFormats = [
    "mp4",
    "webm",
    "mov",
    "mkv",
    "avi",
    "flv",
    "wmv",
    "mp3",
    "wav",
    "ogg",
    "flac",
    "m4a",
    "aac",
    "wma",
  ];

  readonly supportedOutputFormats = [
    "mp3",
    "wav",
    "ogg",
    "flac",
    "m4a",
    "aac",
    "mp4",
    "webm",
    "mov",
    "mkv",
    "gif",
  ];

  private availableCache: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.availableCache !== null) return this.availableCache;

    return new Promise<boolean>((resolve) => {
      const proc = spawn(ENV.FFMPEG_PATH, ["-version"]);
      proc.on("error", () => {
        this.availableCache = false;
        resolve(false);
      });
      proc.on("close", (code) => {
        this.availableCache = code === 0;
        resolve(this.availableCache);
      });
    });
  }

  async convert(
    inputPath: string,
    outputPath: string,
    options: ConversionOptions,
    onProgress?: (progress: number, message?: string) => void,
    signal?: AbortSignal,
  ): Promise<ConversionResult> {
    const isReady = await this.isAvailable();
    if (!isReady) {
      throw new Error(
        `FFMPEG_NOT_AVAILABLE: FFmpeg binary is not available at '${ENV.FFMPEG_PATH}' or on PATH.`,
      );
    }

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Source file does not exist: ${inputPath}`);
    }

    // Build FFmpeg command arguments
    const args: string[] = ["-y", "-i", inputPath];

    // Trimming
    if (options.trimStart !== undefined && options.trimStart >= 0) {
      args.push("-ss", options.trimStart.toString());
    }
    if (
      options.trimEnd !== undefined &&
      options.trimEnd > (options.trimStart || 0)
    ) {
      const duration = options.trimEnd - (options.trimStart || 0);
      args.push("-t", duration.toString());
    }

    // Audio extraction / options
    const targetExt = path.extname(outputPath).toLowerCase().replace(/^\./, "");
    const isAudioOutput = ["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(
      targetExt,
    );

    if (isAudioOutput) {
      if (options.muteAudio) {
        args.push("-an");
      } else {
        if (targetExt === "mp3") {
          args.push("-c:a", "libmp3lame");
          if (options.bitrate) {
            args.push("-b:a", options.bitrate);
          }
        } else if (targetExt === "wav") {
          args.push("-c:a", "pcm_s16le");
        } else if (targetExt === "aac" || targetExt === "m4a") {
          args.push("-c:a", "aac");
        } else if (targetExt === "ogg") {
          args.push("-c:a", "libvorbis");
        } else if (targetExt === "flac") {
          args.push("-c:a", "flac");
        }

        if (options.sampleRate) {
          args.push("-ar", options.sampleRate.toString());
        }
        if (options.channels) {
          args.push("-ac", options.channels.toString());
        }
        if (options.normalizeAudio) args.push("-af", "loudnorm");
      }
    } else {
      // Video options
      if (options.muteAudio) {
        args.push("-an");
      }
      if (options.fps) {
        args.push("-r", options.fps.toString());
      }
      if (options.resolution) {
        args.push("-s", options.resolution);
      }
      if (options.speedMultiplier && options.speedMultiplier > 0) {
        const speed = options.speedMultiplier;
        const audioFilters: string[] = [];
        let remaining = speed;
        while (remaining > 2) { audioFilters.push("atempo=2"); remaining /= 2; }
        while (remaining < 0.5) { audioFilters.push("atempo=0.5"); remaining /= 0.5; }
        audioFilters.push(`atempo=${remaining}`);
        args.push("-filter_complex", `[0:v]setpts=${1 / speed}*PTS[v];[0:a]${audioFilters.join(",")}[a]`, "-map", "[v]", "-map", "[a]");
      }
      if (targetExt === "mp4") {
        const crf = options.quality === undefined
          ? 23
          : Math.max(18, Math.min(40, 51 - Math.round(options.quality * 0.4)));
        args.push(
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          crf.toString(),
          "-c:a",
          "aac",
        );
      } else if (targetExt === "webm") {
        args.push(
          "-c:v",
          "libvpx-vp9",
          "-crf",
          "30",
          "-b:v",
          "0",
          "-c:a",
          "libopus",
        );
      } else if (targetExt === "gif") {
        args.push("-filter_complex", "[0:v]split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse");
      }
    }

    args.push(outputPath);

    logger.info(`Spawning FFmpeg: ${ENV.FFMPEG_PATH} ${args.join(" ")}`);

    return new Promise<ConversionResult>((resolve, reject) => {
      const proc = spawn(ENV.FFMPEG_PATH, args, { windowsHide: true });
      let settled = false;
      let terminationReason: "cancelled" | "timeout" | null = null;
      const removePartial = () => {
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch { /* best effort */ }
      };
      const terminate = (reason: "cancelled" | "timeout") => {
        if (settled) return;
        terminationReason = reason;
        proc.kill("SIGTERM");
      };
      const abortHandler = () => terminate("cancelled");
      signal?.addEventListener("abort", abortHandler, { once: true });
      if (signal?.aborted) abortHandler();
      const timeout = setTimeout(() => terminate("timeout"), ENV.FFMPEG_TIMEOUT_MS);

      let stderrLog = "";

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        stderrLog += text;

        // Parse duration and time progress from FFmpeg stderr
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch && onProgress) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseFloat(timeMatch[3]);
          const currentSeconds = hours * 3600 + minutes * 60 + seconds;
          onProgress(-1, `Processing timestamp: ${timeMatch[0]}`);
        }
      });

      proc.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortHandler);
        removePartial();
        logger.error(`FFmpeg process error: ${err.message}`);
        reject(err);
      });

      proc.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abortHandler);
        if (terminationReason) {
          removePartial();
          return reject(new Error(terminationReason === "timeout" ? "FFMPEG_TIMEOUT" : "FFMPEG_CANCELLED"));
        }
        if (code !== 0) {
          const errMsg = `FFmpeg exited with code ${code}. Error log: ${stderrLog.slice(-500)}`;
          logger.error(errMsg);
          return reject(new Error(errMsg));
        }

        if (!fs.existsSync(outputPath)) {
          return reject(
            new Error(
              `Conversion appeared to succeed, but output file was not found at ${outputPath}`,
            ),
          );
        }

        const stat = fs.statSync(outputPath);
        const mimeType = targetExt === "mp3" ? "audio/mpeg" : targetExt === "gif" ? "image/gif" : isAudioOutput
          ? `audio/${targetExt}` : `video/${targetExt}`;

        resolve({
          outputPath,
          outputFilename: path.basename(outputPath),
          mimeType,
          size: stat.size,
        });
      });
    });
  }
}

export const serverFFmpegEngine = new ServerFFmpegEngine();
