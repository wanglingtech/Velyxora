import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { providerRegistry } from "../src/providers/ProviderRegistry";
import { normalizeFormats } from "../src/services/ytDlpService";
import { backendApp } from "../src/app";
import { ytDlpService } from "../src/services/ytDlpService";
import { ENV } from "../src/config/env";

test("provider registry detects first-level providers and falls back to GenericProvider", () => {
  const cases = [
    ["https://youtube.com/watch?v=x", "youtube"], ["https://tiktok.com/@a/video/1", "tiktok"],
    ["https://instagram.com/reel/x", "instagram"], ["https://facebook.com/watch/x", "facebook"],
    ["https://x.com/a/status/1", "twitter"], ["https://vimeo.com/1", "vimeo"],
    ["https://reddit.com/r/a/comments/x", "reddit"], ["https://twitch.tv/a", "twitch"],
    ["https://soundcloud.com/a/b", "soundcloud"], ["https://example.com/media", "generic"],
  ];
  for (const [url, expected] of cases) assert.equal(providerRegistry.find(url).platform, expected);
});

test("yt-dlp formats are normalized, deduplicated and include real MP3 conversion choices", () => {
  const formats = normalizeFormats([
    { format_id: "v1", ext: "mp4", vcodec: "h264", acodec: "none", height: 720, fps: 30, filesize: 1000 },
    { format_id: "v2", ext: "mp4", vcodec: "h264", acodec: "none", height: 720, fps: 30, filesize: 1100 },
    { format_id: "a1", ext: "m4a", vcodec: "none", acodec: "aac", abr: 128 },
  ]);
  assert.equal(formats.filter((format) => format.type === "video").length, 1);
  assert.ok(formats.some((format) => format.formatId === "audio-mp3-192" && format.container === "mp3"));
});

test("media process rejects unsafe URLs and invalid format IDs", async () => {
  const unsafe = await request(backendApp).post("/api/media/process").send({ url: "http://127.0.0.1/video", formatId: "best", container: "mp4", type: "video" });
  assert.equal(unsafe.status, 422);
  const invalid = await request(backendApp).post("/api/media/process").send({ url: "https://example.com/video", formatId: "best;whoami", container: "mp4", type: "video" });
  assert.equal(invalid.status, 422);
});

test("yt-dlp unavailable is reported without throwing process-level errors", async () => {
  const configured = ENV.YT_DLP_PATH;
  ENV.YT_DLP_PATH = "definitely-missing-velyxora-ytdlp";
  try {
    assert.equal(await ytDlpService.isAvailable(), false);
  } finally {
    ENV.YT_DLP_PATH = configured;
  }
});
