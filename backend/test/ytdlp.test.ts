import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { providerRegistry } from "../src/providers/ProviderRegistry";
import { buildAnalyzeArgs, friendlyError, isRequestedFormatAvailable, normalizeFormats, parseAnalysis } from "../src/services/ytDlpService";
import { backendApp } from "../src/app";
import { ytDlpService } from "../src/services/ytDlpService";
import { ENV } from "../src/config/env";
import { readFile } from "node:fs/promises";

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

test("analyze requests JSON metadata and formats without selecting or downloading a format", () => {
  const args = buildAnalyzeArgs("https://youtube.com/watch?v=public-id");
  assert.ok(args.includes("--dump-single-json"));
  assert.ok(args.includes("--skip-download"));
  assert.ok(args.includes("--ignore-no-formats-error"));
  assert.ok(args.includes("--ignore-config"));
  assert.equal(args.includes("-f"), false);
  assert.equal(args.includes("--format"), false);
  assert.equal(args.includes("-o"), false);
  assert.equal(args.includes("--output"), false);
});

test("analyze parses metadata and advertised formats without inventing downloadable media", () => {
  const result = parseAnalysis({
    webpage_url: "https://youtube.com/watch?v=public-id",
    title: "Public video", uploader: "Creator", duration: 42,
    formats: [
      { format_id: "v720", ext: "mp4", vcodec: "h264", acodec: "none", height: 720 },
      { format_id: "a128", ext: "m4a", vcodec: "none", acodec: "aac", abr: 128 },
    ],
  }, "https://youtu.be/public-id", "youtube");
  assert.equal(result.title, "Public video");
  assert.equal(result.durationSeconds, 42);
  assert.ok(result.formats.some((format) => format.formatId === "v720"));
  assert.ok(result.formats.some((format) => format.formatId === "audio-mp3-192"));
  assert.equal(result.isDirectDownloadPossible, true);

  const metadataOnly = parseAnalysis({ title: "Metadata only", formats: [] }, "https://x.com/a/status/1", "twitter");
  assert.deepEqual(metadataOnly.formats, []);
  assert.equal(metadataOnly.isDirectDownloadPossible, false);
});

test("process format validation uses the formats from a fresh analysis", () => {
  const formats = normalizeFormats([{ format_id: "current", ext: "mp4", vcodec: "h264", acodec: "aac" }]);
  assert.equal(isRequestedFormatAvailable(formats, "current"), true);
  assert.equal(isRequestedFormatAvailable(formats, "expired"), false);
});

test("analyze and process errors keep stage-specific format messages", () => {
  const stderr = "ERROR: Requested format is not available";
  const analyzeError = friendlyError(stderr, "analyze");
  const processError = friendlyError(stderr, "process");
  assert.equal(analyzeError.code, "ANALYZE_FORMATS_UNAVAILABLE");
  assert.doesNotMatch(analyzeError.message, /seleccionado/i);
  assert.equal(processError.code, "FORMAT_UNAVAILABLE");
  assert.match(processError.message, /seleccionado/i);
  assert.equal(friendlyError("ERROR: [facebook] Cannot parse data", "analyze").code, "EXTRACTOR_CHANGED");
});

test("production Docker pins and verifies yt-dlp instead of using Debian's stale package", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8");
  assert.match(dockerfile, /ARG YT_DLP_VERSION=2026\.08\.19/);
  assert.match(dockerfile, /ARG YT_DLP_SHA256=[a-f0-9]{64}/);
  assert.match(dockerfile, /sha256sum --check --strict/);
  assert.match(dockerfile, /yt-dlp --version/);
  assert.doesNotMatch(dockerfile, /^\s*yt-dlp\s*\\$/m);
  assert.doesNotMatch(dockerfile, /yt-dlp\s+-U/);
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
