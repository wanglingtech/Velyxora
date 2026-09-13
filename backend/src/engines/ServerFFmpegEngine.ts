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
      if (targetExt === "mp4") {
        args.push(
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
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
      }
    }

    args.push(outputPath);

    logger.info(`Spawning FFmpeg: ${ENV.FFMPEG_PATH} ${args.join(" ")}`);

    return new Promise<ConversionResult>((resolve, reject) => {
      const proc = spawn(ENV.FFMPEG_PATH, args);

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
        logger.error(`FFmpeg process error: ${err.message}`);
        reject(err);
      });

      proc.on("close", (code) => {
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
        const mimeType = isAudioOutput
          ? `audio/${targetExt}`
          : `video/${targetExt}`;

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
