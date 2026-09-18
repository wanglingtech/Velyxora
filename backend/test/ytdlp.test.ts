import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { providerRegistry } from "../src/providers/ProviderRegistry";
import { assertUsableAnalysisFormats, buildAnalyzeArgs, buildTikTokFailureDiagnostic, classifyTikTokFailure, classifyWarnings, friendlyError, isRequestedFormatAvailable, normalizeFormats, normalizeFormatsWithDiagnostics, parseAnalysis, selectThumbnail } from "../src/services/ytDlpService";
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
  assert.equal(formats.filter((format) => format.type === "video").length, 2);
  assert.ok(formats.some((format) => format.formatId === "audio-mp3-192" && format.container === "mp3"));
});

test("normalization preserves video-only, audio-only and combined adaptive formats", () => {
  const { formats, diagnostics } = normalizeFormatsWithDiagnostics([
    { format_id: "video", ext: "mp4", vcodec: "avc1", acodec: "none", height: 1080 },
    { format_id: "audio", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", abr: 128 },
    { format_id: "combined", ext: "mp4", vcodec: "avc1", acodec: "mp4a.40.2", height: 360 },
  ]);
  assert.ok(formats.some((format) => format.formatId === "video" && format.hasVideo && !format.hasAudio));
  assert.ok(formats.some((format) => format.formatId === "audio" && !format.hasVideo && format.hasAudio));
  assert.ok(formats.some((format) => format.formatId === "combined" && format.hasVideo && format.hasAudio));
  assert.equal(diagnostics.rawFormatsCount, 3);
  assert.equal(diagnostics.afterDeduplication, 3);
  assert.equal(diagnostics.videoCount, 2);
  assert.equal(diagnostics.combinedCount, 1);
  assert.ok(diagnostics.audioCount >= 1);
});

test("format diagnostics distinguish empty extractor output from filtered non-media entries", () => {
  const empty = normalizeFormatsWithDiagnostics([]).diagnostics;
  assert.equal(empty.rawFormatsCount, 0);
  assert.equal(empty.normalizedFormatsCount, 0);
  const filtered = normalizeFormatsWithDiagnostics([
    { format_id: "storyboard", ext: "mhtml", vcodec: "none", acodec: "none" },
    { ext: "mp4", vcodec: "avc1", acodec: "none" },
  ]).diagnostics;
  assert.equal(filtered.rawFormatsCount, 2);
  assert.equal(filtered.afterIdFilter, 1);
  assert.equal(filtered.afterCodecFilter, 0);
  assert.equal(filtered.normalizedFormatsCount, 0);
  assert.throws(() => assertUsableAnalysisFormats("youtube", empty), (error: any) => error.code === "MEDIA_FORMATS_UNAVAILABLE");
  assert.throws(() => assertUsableAnalysisFormats("youtube", filtered), (error: any) => error.code === "MEDIA_FORMATS_UNAVAILABLE");
});

test("YouTube bot verification is reported as provider restriction without affecting other providers", () => {
  const empty = normalizeFormatsWithDiagnostics([]).diagnostics;
  assert.throws(
    () => assertUsableAnalysisFormats("youtube", empty, ["bot_verification"]),
    (error: any) => error.code === "MEDIA_PROVIDER_RESTRICTED" && /proveedor no permitió/i.test(error.message),
  );
  assert.throws(
    () => assertUsableAnalysisFormats("vimeo", empty, ["bot_verification"]),
    (error: any) => error.code === "MEDIA_FORMATS_UNAVAILABLE",
  );
});

test("TikTok post access restriction is provider-specific and unknown failures remain generic", () => {
  const blocked = "ERROR: [TikTok] 123: Your IP address is blocked from accessing this post";
  const tiktokError = friendlyError(blocked, "analyze", "tiktok");
  assert.equal(tiktokError.code, "MEDIA_PROVIDER_RESTRICTED");
  assert.equal(tiktokError.message, "TikTok no permitió acceder a este contenido desde el servidor. Prueba con otra publicación pública o inténtalo más tarde.");
  assert.equal(friendlyError("ERROR: [TikTok] unexpected response", "analyze", "tiktok").code, "PROVIDER_UNAVAILABLE");
  assert.equal(friendlyError(blocked, "analyze", "vimeo").code, "PROVIDER_UNAVAILABLE");
});

test("TikTok failures are classified into closed sanitized reasons", () => {
  const cases = [
    ["Your IP address is blocked from accessing this post", "post_access_restricted"],
    ["Unable to extract challenge data", "challenge_data_unavailable"],
    ["Unable to solve JS challenge", "challenge_solve_failed"],
    ["Unexpected response from webpage request", "unexpected_webpage_response"],
    ["Unable to extract universal data for rehydration", "web_data_unavailable"],
    ["Unable to extract webpage video data", "webpage_video_data_unavailable"],
    ["TikTok is requiring login for access to this content", "login_required"],
    ["This post may not be comfortable for some audiences. Log in for access", "sensitive_content_login_required"],
    ["The extractor is attempting impersonation, but no impersonate target is available", "impersonation_unavailable"],
  ] as const;
  for (const [stderr, expected] of cases) {
    assert.equal(classifyTikTokFailure(`ERROR: [TikTok] ${stderr}`, "tiktok"), expected);
  }
  assert.equal(classifyTikTokFailure("ERROR: [TikTok] unknown extraction failure", "tiktok"), "unclassified");
});

test("TikTok classification is provider-specific and fatal failures take precedence over impersonation warnings", () => {
  const impersonation = "WARNING: The extractor is attempting impersonation, but no impersonate target is available";
  const challenge = "ERROR: Unable to solve JS challenge";
  assert.equal(classifyTikTokFailure(`${impersonation}\n${challenge}`, "tiktok"), "challenge_solve_failed");
  assert.equal(classifyTikTokFailure(impersonation, "tiktok"), "impersonation_unavailable");
  assert.equal(classifyTikTokFailure(challenge, "youtube"), "unclassified");
  assert.equal(friendlyError(impersonation, "analyze", "tiktok").code, "PROVIDER_UNAVAILABLE");
});

test("TikTok diagnostics expose only closed non-sensitive fields", () => {
  const sensitiveStderr = "ERROR URL=https://tiktok.com/@private/video/1 IP=192.0.2.1 cookie=session token=secret Authorization=Bearer-secret Unable to solve JS challenge";
  const diagnostic = buildTikTokFailureDiagnostic(sensitiveStderr, "analyze", 1);
  assert.deepEqual(diagnostic, {
    provider: "tiktok",
    stage: "analyze",
    reason: "challenge_solve_failed",
    exitCode: 1,
  });
  assert.deepEqual(Object.keys(diagnostic), ["provider", "stage", "reason", "exitCode"]);
  const serialized = JSON.stringify(diagnostic);
  for (const secret of ["stderr", "stdout", "tiktok.com", "192.0.2.1", "cookie", "secret", "authorization", "header"]) {
    assert.doesNotMatch(serialized.toLowerCase(), new RegExp(secret.replace(".", "\\.")));
  }
});

test("TikTok access reasons preserve the existing public error mapping", () => {
  const blocked = "Your IP address is blocked from accessing this post";
  const login = "TikTok is requiring login for access to this content";
  const sensitive = "This post may not be comfortable for some audiences. Log in for access";
  assert.equal(friendlyError(blocked, "analyze", "tiktok").code, "MEDIA_PROVIDER_RESTRICTED");
  assert.equal(friendlyError(login, "analyze", "tiktok").code, "NOT_PUBLIC");
  assert.equal(friendlyError(sensitive, "analyze", "tiktok").code, "PROVIDER_UNAVAILABLE");
});

test("thumbnail selection avoids a known maxres candidate and warning logs are categorized", () => {
  assert.equal(selectThumbnail({
    thumbnail: "https://i.ytimg.com/vi/id/maxresdefault.webp",
    thumbnails: [
      { url: "https://i.ytimg.com/vi/id/maxresdefault.webp", width: 1280 },
      { url: "https://i.ytimg.com/vi/id/hqdefault.jpg", width: 480 },
    ],
  }), "https://i.ytimg.com/vi/id/hqdefault.jpg");
  assert.deepEqual(classifyWarnings("WARNING: missing PO Token; SABR formats unavailable"), ["po_token_required", "sabr_restriction", "formats_unavailable"]);
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
