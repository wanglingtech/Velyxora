import { spawn } from "child_process";
import { ENV } from "../config/env";

export interface MediaProbeStream {
  codecType?: string;
  codecName?: string;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  bitRate?: number;
  [key: string]: unknown;
}

export interface MediaProbeResult {
  format: string;
  duration?: number;
  bitRate?: number;
  streams: MediaProbeStream[];
}

export async function isFfprobeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(ENV.FFPROBE_PATH, ["-version"], {
      windowsHide: true,
    });
    process.once("error", () => resolve(false));
    process.once("close", (code) => resolve(code === 0));
  });
}

export async function probeMedia(inputPath: string): Promise<MediaProbeResult> {
  const result = await new Promise<string>((resolve, reject) => {
    const process = spawn(
      ENV.FFPROBE_PATH,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        inputPath,
      ],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    process.once("error", () =>
      reject(
        new Error(
          "FFPROBE_NOT_AVAILABLE: ffprobe is not installed or not on PATH.",
        ),
      ),
    );
    process.once("close", (code) => {
      if (code !== 0)
        reject(
          new Error(`FFPROBE_FAILED: ${stderr.trim() || `exit code ${code}`}`),
        );
      else resolve(stdout);
    });
  });

  const data = JSON.parse(result) as {
    format?: { format_name?: string; duration?: string; bit_rate?: string };
    streams?: Array<Record<string, unknown>>;
  };
  return {
    format: data.format?.format_name || "unknown",
    duration: data.format?.duration ? Number(data.format.duration) : undefined,
    bitRate: data.format?.bit_rate ? Number(data.format.bit_rate) : undefined,
    streams: (data.streams || []).map((stream) => ({
      ...stream,
      codecType: typeof stream.codec_type === "string" ? stream.codec_type : undefined,
      codecName: typeof stream.codec_name === "string" ? stream.codec_name : undefined,
      width: typeof stream.width === "number" ? stream.width : undefined,
      height: typeof stream.height === "number" ? stream.height : undefined,
      sampleRate: stream.sample_rate ? Number(stream.sample_rate) : undefined,
      channels:
        typeof stream.channels === "number" ? stream.channels : undefined,
      duration: stream.duration ? Number(stream.duration) : undefined,
      bitRate: stream.bit_rate ? Number(stream.bit_rate) : undefined,
    })) as MediaProbeStream[],
  };
}
