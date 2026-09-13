import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import request from "supertest";
import { serverFFmpegEngine } from "../src/engines/ServerFFmpegEngine";
import { isFfprobeAvailable, probeMedia } from "../src/utils/mediaProbe";
import { ENV } from "../src/config/env";
import { backendApp } from "../src/app";
import { storageService } from "../src/services/storageService";

const run = (binary: string, args: string[]) => new Promise<void>((resolve, reject) => {
  const child = spawn(binary, args, { windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.once("error", reject);
  child.once("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-1000))));
});

test("real FFmpeg/FFprobe conversions, cancellation, timeout and HTTP download", async (context) => {
  if (!await serverFFmpegEngine.isAvailable() || !await isFfprobeAvailable()) {
    context.skip("FFmpeg and FFprobe are required for real integration fixtures.");
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "velyxora-ffmpeg-"));
  const file = (name: string) => path.join(dir, name);
  const wav = file("tone.wav"), mp3 = file("tone.mp3"), wav2 = file("roundtrip.wav");
  const video = file("video.mp4"), videoMp3 = file("video.mp3"), trim = file("trim.mp4");
  const mute = file("mute.mp4"), speed = file("speed.mp4"), compressed = file("compressed.mp4");
  const gif = file("video.gif"), normalized = file("normalized.mp3");
  try {
    await run(ENV.FFMPEG_PATH, ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=5", "-c:a", "pcm_s16le", wav]);
    await run(ENV.FFMPEG_PATH, ["-y", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=24:duration=5", "-f", "lavfi", "-i", "sine=frequency=660:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video]);

    await serverFFmpegEngine.convert(wav, mp3, { targetFormat: "mp3", bitrate: "128k" });
    let probe = await probeMedia(mp3);
    assert.match(probe.format, /mp3/);
    assert.equal(probe.streams.some((s) => s.codecType === "audio" && s.codecName === "mp3"), true);

    await serverFFmpegEngine.convert(mp3, wav2, { targetFormat: "wav" });
    probe = await probeMedia(wav2);
    assert.match(probe.format, /wav/);
    assert.equal(probe.streams.some((s) => s.codecName === "pcm_s16le"), true);

    await serverFFmpegEngine.convert(video, videoMp3, { targetFormat: "mp3", bitrate: "192k" });
    probe = await probeMedia(videoMp3);
    assert.match(probe.format, /mp3/);
    assert.equal(probe.streams.some((s) => s.codecName === "mp3"), true);

    await serverFFmpegEngine.convert(video, trim, { targetFormat: "mp4", trimStart: 1, trimEnd: 3 });
    probe = await probeMedia(trim);
    assert.ok(probe.duration! >= 1.8 && probe.duration! <= 2.3);

    await serverFFmpegEngine.convert(video, mute, { targetFormat: "mp4", muteAudio: true });
    assert.equal((await probeMedia(mute)).streams.some((s) => s.codecType === "audio"), false);

    await serverFFmpegEngine.convert(video, speed, { targetFormat: "mp4", speedMultiplier: 2 });
    probe = await probeMedia(speed);
    assert.ok(probe.duration! >= 2.3 && probe.duration! <= 2.8);

    await serverFFmpegEngine.convert(video, compressed, { targetFormat: "mp4", quality: 70 });
    assert.equal((await probeMedia(compressed)).streams.some((s) => s.codecName === "h264"), true);

    await serverFFmpegEngine.convert(video, gif, { targetFormat: "gif" });
    probe = await probeMedia(gif);
    assert.match(probe.format, /gif/);
    assert.equal(probe.streams[0]?.width, 320);

    await serverFFmpegEngine.convert(wav, normalized, { targetFormat: "mp3", normalizeAudio: true });
    assert.ok((await probeMedia(normalized)).streams.length > 0);

    const controller = new AbortController();
    const cancelled = file("cancelled.mp4");
    const pending = serverFFmpegEngine.convert(video, cancelled, { targetFormat: "mp4" }, undefined, controller.signal);
    controller.abort();
    await assert.rejects(pending, /FFMPEG_CANCELLED/);
    assert.equal(fs.existsSync(cancelled), false);

    const oldTimeout = ENV.FFMPEG_TIMEOUT_MS;
    ENV.FFMPEG_TIMEOUT_MS = 1;
    const timedOut = file("timeout.mp4");
    try {
      await assert.rejects(serverFFmpegEngine.convert(video, timedOut, { targetFormat: "mp4" }), /FFMPEG_TIMEOUT/);
      assert.equal(fs.existsSync(timedOut), false);
    } finally { ENV.FFMPEG_TIMEOUT_MS = oldTimeout; }

    const upload = await request(backendApp).post("/api/uploads").attach("file", video, { filename: "e2e-video.mp4", contentType: "video/mp4" });
    assert.equal(upload.status, 201);
    const fileId = upload.body.data.fileId;
    try {
      const started = await request(backendApp).post("/api/conversions").send({ fileId, toolId: "video-to-mp3", targetFormat: "mp3", options: { bitrate: "128k" } });
      assert.equal(started.status, 202);
      let job: any;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        job = (await request(backendApp).get(`/api/jobs/${started.body.data.id}`)).body.data;
        if (["COMPLETED", "FAILED"].includes(job.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(job.status, "COMPLETED", job.error);
      const download = await request(backendApp).get(`/api/download/${job.output.fileId}`);
      assert.equal(download.status, 200);
      assert.match(download.headers["content-type"], /audio\/mpeg/);
      assert.match(download.headers["content-disposition"], /attachment/);
      assert.ok(Number(download.headers["content-length"]) > 0);
      assert.equal((await probeMedia(job.output.path)).streams.some((s) => s.codecName === "mp3"), true);
      storageService.deleteFile(job.output.fileId);
    } finally { storageService.deleteFile(fileId); }

    const cancelUpload = await request(backendApp).post("/api/uploads").attach("file", video, { filename: "cancel-video.mp4", contentType: "video/mp4" });
    const cancelFileId = cancelUpload.body.data.fileId;
    const cancelStarted = await request(backendApp).post("/api/conversions").send({ fileId: cancelFileId, toolId: "video-compressor", targetFormat: "mp4", options: { quality: 100 } });
    const cancelledResponse = await request(backendApp).delete(`/api/conversions/${cancelStarted.body.data.id}`);
    assert.equal(cancelledResponse.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const cancelledJob = (await request(backendApp).get(`/api/jobs/${cancelStarted.body.data.id}`)).body.data;
    assert.equal(cancelledJob.status, "CANCELLED");
    assert.equal(cancelledJob.output, undefined);
    assert.equal(fs.existsSync(path.join(ENV.STORAGE_DIR, `converted-${cancelStarted.body.data.id}-cancel-video.mp4`)), false);
    storageService.deleteFile(cancelFileId);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
