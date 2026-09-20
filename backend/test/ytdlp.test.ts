import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { providerRegistry } from "../src/providers/ProviderRegistry";
import { assertUsableAnalysisFormats, buildAnalyzeArgs, buildAnalyzeExecutionPlan, buildDownloadArgs, buildEffectiveYtDlpArgs, buildTikTokFailureDiagnostic, buildTikTokStagingDiagnostic, buildYouTubeRawFormatDiagnostics, classifyTikTokFailure, classifyWarnings, friendlyError, isRequestedFormatAvailable, normalizeFormats, normalizeFormatsWithDiagnostics, parseAnalysis, parseImpersonationTargetFamily, parseStagingRuntimeDiagnostics, parseTikTokVerboseDiagnostics, parseYouTubeJscDiagnostics, parseYouTubePotDiagnostics, parseYouTubeRuntimeDiagnostic, selectThumbnail, shouldEnableTikTokStagingDiagnostics, shouldEnableYouTubeDiagnostics, withYouTubeDiagnosticsArgs } from "../src/services/ytDlpService";
import { backendApp } from "../src/app";
import { ytDlpService } from "../src/services/ytDlpService";
import { ENV, parseBooleanFlag } from "../src/config/env";
import { readFile } from "node:fs/promises";
import { buildYouTubeYtDlpArgs, parseInternalPoProviderUrl, YouTubeProvider, YOUTUBE_PO_PROVIDER_VERSION } from "../src/providers/YouTubeProvider";
import { YtDlpProvider } from "../src/providers/YtDlpProvider";

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

test("provider registry activates the dedicated YouTube provider only for YouTube", () => {
  assert.ok(providerRegistry.find("https://youtube.com/watch?v=x") instanceof YouTubeProvider);
  for (const url of ["https://tiktok.com/@a/video/1", "https://facebook.com/watch/x", "https://vimeo.com/1"]) {
    const provider = providerRegistry.find(url);
    assert.ok(provider instanceof YtDlpProvider);
    assert.equal(provider instanceof YouTubeProvider, false);
  }
});

test("YouTube PO provider URL accepts only private HTTP service addresses", () => {
  for (const value of [
    "http://youtube-pot-provider:4416",
    "http://service.internal:4416",
    "http://127.0.0.1:4416",
    "http://[::1]:4416",
  ]) assert.ok(parseInternalPoProviderUrl(value), value);

  for (const value of [
    "", "https://youtube-pot-provider:4416", "http://example.com:4416",
    "http://8.8.8.8:4416", "http://user:pass@localhost:4416",
    "http://localhost:4416/get_pot", "http://localhost:4416?token=secret",
  ]) assert.equal(parseInternalPoProviderUrl(value), null, value);
});

test("YouTube arguments are isolated and identical for analysis and download builders", () => {
  const providerUrl = parseInternalPoProviderUrl("http://youtube-pot-provider:4416");
  assert.ok(providerUrl);
  const youtubeArgs = buildYouTubeYtDlpArgs(providerUrl);
  assert.deepEqual(youtubeArgs, [
    "--extractor-args", "youtube:player-client=mweb",
    "--extractor-args", "youtubepot-bgutilhttp:base_url=http://youtube-pot-provider:4416",
  ]);
  assert.equal(youtubeArgs.filter((value) => value === "--extractor-args").length, 2);
  assert.equal(youtubeArgs.some((value) => value.includes(";")), false);
  const analyzeArgs = buildAnalyzeArgs("https://youtube.com/watch?v=public-id", youtubeArgs);
  const downloadArgs = buildDownloadArgs("https://youtube.com/watch?v=public-id", "18", "mp4", "video", "/tmp/output", youtubeArgs);
  for (const value of youtubeArgs.filter((_, index) => index % 2 === 1)) {
    assert.ok(analyzeArgs.includes(value));
    assert.ok(downloadArgs.includes(value));
  }
  const otherProviderArgs = buildAnalyzeArgs("https://tiktok.com/@a/video/1");
  assert.equal(otherProviderArgs.some((value) => value.includes("player-client") || value.includes("bgutil")), false);
});

test("YouTube diagnostics flag preserves disabled args and only enables supported diagnostics for YouTube", () => {
  const base = buildAnalyzeArgs("https://youtube.com/watch?v=public-id", [
    "--extractor-args", "youtube:player-client=mweb",
    "--extractor-args", "youtubepot-bgutilhttp:base_url=http://youtube-pot-provider:4416",
  ]);
  assert.deepEqual(withYouTubeDiagnosticsArgs(base, false), base);
  assert.equal(shouldEnableYouTubeDiagnostics(true, "youtube"), true);
  for (const provider of ["tiktok", "facebook", "instagram"] as const) {
    assert.equal(shouldEnableYouTubeDiagnostics(true, provider), false);
  }
  const enabled = withYouTubeDiagnosticsArgs(base, true);
  assert.equal(enabled.filter((arg) => arg === "--verbose").length, 1);
  assert.ok(enabled.includes("youtube:pot_trace=true;jsc_trace=true"));
  assert.ok(enabled.includes("youtube:player-client=mweb"));
  assert.ok(enabled.includes("youtubepot-bgutilhttp:base_url=http://youtube-pot-provider:4416"));
  const effectiveAnalyze = buildEffectiveYtDlpArgs(base, parseBooleanFlag("true"), "youtube", "analyze");
  assert.ok(effectiveAnalyze.includes("--verbose"));
  assert.ok(effectiveAnalyze.includes("youtube:pot_trace=true;jsc_trace=true"));
  assert.deepEqual(buildEffectiveYtDlpArgs(base, true, "facebook", "analyze"), base);
  assert.equal(parseBooleanFlag(" TRUE "), true);
  assert.equal(parseBooleanFlag("false"), false);
});

test("YouTube diagnostic parsers expose only closed runtime, POT and JSC states", () => {
  const stderr = [
    "[debug] [youtube] [pot] PO Token Providers: bgutil:http-2.0.0 (external)",
    "[debug] JS runtimes: node-22.0",
    "[debug] JS Challenge Providers: ejs:0.8.0",
    "[debug] [youtube] [pot] gvs PO Token successfully obtained token=SUPER-SECRET",
    "[debug] [youtube] signature challenge requested for https://example.test/videoplayback?sig=SECRET",
    "[debug] [youtube] signature challenge resolved",
    "[warning] [youtube] n challenge failed Authorization: Bearer SECRET cookie=session",
  ].join("\n");
  assert.deepEqual(parseYouTubeRuntimeDiagnostic(stderr, "analyze", true), {
    stage: "analyze", playerClient: "mweb", pluginDetected: true, poProviderDetected: true,
    poProviderReachable: true, ejsDetected: true, jsRuntime: "node",
  });
  assert.deepEqual(parseYouTubePotDiagnostics(stderr, "analyze"), [
    { stage: "analyze", context: "gvs", status: "success" },
  ]);
  assert.deepEqual(parseYouTubeJscDiagnostics(stderr, "analyze"), [
    { stage: "analyze", challenge: "signature", status: "resolved" },
    { stage: "analyze", challenge: "n", status: "failed" },
  ]);
  const serialized = JSON.stringify({
    runtime: parseYouTubeRuntimeDiagnostic(stderr, "analyze", true),
    pot: parseYouTubePotDiagnostics(stderr, "analyze"),
    jsc: parseYouTubeJscDiagnostics(stderr, "analyze"),
  }).toLowerCase();
  for (const forbidden of ["super-secret", "example.test", "videoplayback", "authorization", "bearer", "cookie", "session", "?sig="]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("YouTube POT diagnostics distinguish failure, unavailable and unknown without exposing values", () => {
  assert.deepEqual(parseYouTubePotDiagnostics("gvs PO Token generation failed token=SECRET", "download"), [
    { stage: "download", context: "gvs", status: "failed" },
  ]);
  assert.deepEqual(parseYouTubePotDiagnostics("player PO Token provider unavailable at https://secret.test/?token=x", "revalidate-format"), [
    { stage: "revalidate-format", context: "player", status: "unavailable" },
  ]);
  assert.deepEqual(parseYouTubePotDiagnostics("subs PO Token state changed token=SECRET", "analyze"), [
    { stage: "analyze", context: "subs", status: "unknown" },
  ]);
  assert.deepEqual(parseYouTubePotDiagnostics("PO Token Providers: bgutil:http-2.0.0", "analyze"), [
    { stage: "analyze", context: "unknown", status: "unknown" },
  ]);
  assert.deepEqual(parseYouTubeJscDiagnostics("", "analyze"), [
    { stage: "analyze", challenge: "unknown", status: "unknown" },
  ]);
});

test("YouTube raw format diagnostics use a strict allowlist and redact URL-like or secret fields", () => {
  const diagnostics = buildYouTubeRawFormatDiagnostics([{
    format_id: "18", ext: "mp4", vcodec: "avc1", acodec: "mp4a", protocol: "https",
    format_note: "https://media.test/videoplayback?token=SECRET Authorization cookie=session",
  }]);
  assert.deepEqual(Object.keys(diagnostics[0]), ["formatId", "ext", "hasVideoCodec", "hasAudioCodec", "protocol", "formatNote"]);
  assert.deepEqual(diagnostics[0], {
    formatId: "18", ext: "mp4", hasVideoCodec: true, hasAudioCodec: true, protocol: "https", formatNote: null,
  });
  assert.doesNotMatch(JSON.stringify(diagnostics), /media\.test|videoplayback|SECRET|Authorization|cookie|session|\?/i);
});

test("YouTube provider fails closed before yt-dlp when the PO provider is unavailable", { concurrency: false }, async () => {
  const originalUrl = ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL;
  const originalFetch = globalThis.fetch;
  const originalAnalyze = ytDlpService.analyze;
  let ytDlpCalled = false;
  ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL = "http://youtube-pot-provider:4416";
  globalThis.fetch = (async () => { throw new Error("unavailable"); }) as typeof fetch;
  ytDlpService.analyze = (async () => { ytDlpCalled = true; throw new Error("unexpected"); }) as typeof ytDlpService.analyze;
  try {
    await assert.rejects(
      () => new YouTubeProvider().analyze("https://youtube.com/watch?v=public-id"),
      (error: any) => error.code === "MEDIA_PROVIDER_RESTRICTED" && /interno/i.test(error.message),
    );
    assert.equal(ytDlpCalled, false);
  } finally {
    ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL = originalUrl;
    globalThis.fetch = originalFetch;
    ytDlpService.analyze = originalAnalyze;
  }
});

test("YouTube provider applies one strategy to analyze, revalidate and download", { concurrency: false }, async () => {
  const originalUrl = ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL;
  const originalFetch = globalThis.fetch;
  const originalAnalyze = ytDlpService.analyze;
  const originalAssert = ytDlpService.assertFormatAvailable;
  const originalDownload = ytDlpService.download;
  const calls: Array<{ stage: string; args: readonly string[] }> = [];
  ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL = "http://youtube-pot-provider:4416";
  globalThis.fetch = (async () => new Response(JSON.stringify({ version: YOUTUBE_PO_PROVIDER_VERSION }), {
    status: 200, headers: { "content-type": "application/json" },
  })) as typeof fetch;
  ytDlpService.analyze = (async (_url, _platform, args) => {
    calls.push({ stage: "analyze", args });
    return { url: "https://youtube.com/watch?v=x", platform: "youtube", title: "x", formats: [], isDirectDownloadPossible: false, requiresExternalExtractor: true };
  }) as typeof ytDlpService.analyze;
  ytDlpService.assertFormatAvailable = (async (_url, _format, _platform, args) => { calls.push({ stage: "revalidate", args }); }) as typeof ytDlpService.assertFormatAvailable;
  ytDlpService.download = (async (_url, _format, _container, _type, _stem, _signal, _progress, _platform, args) => {
    calls.push({ stage: "download", args }); return "/tmp/output.mp4";
  }) as typeof ytDlpService.download;
  try {
    const provider = new YouTubeProvider();
    await provider.analyze("https://youtube.com/watch?v=x");
    await provider.assertFormatAvailable("https://youtube.com/watch?v=x", "18");
    await provider.download("https://youtube.com/watch?v=x", "18", "mp4", "video", "/tmp/output");
    assert.deepEqual(calls.map(({ stage }) => stage), ["analyze", "revalidate", "download"]);
    assert.deepEqual(calls[0].args, calls[1].args);
    assert.deepEqual(calls[1].args, calls[2].args);
    assert.equal(calls[0].args.filter((value) => value === "--extractor-args").length, 2);
    assert.deepEqual(calls[0].args.filter((_, index) => index % 2 === 1), [
      "youtube:player-client=mweb",
      "youtubepot-bgutilhttp:base_url=http://youtube-pot-provider:4416",
    ]);
  } finally {
    ENV.YOUTUBE_PO_TOKEN_PROVIDER_URL = originalUrl;
    globalThis.fetch = originalFetch;
    ytDlpService.analyze = originalAnalyze;
    ytDlpService.assertFormatAvailable = originalAssert;
    ytDlpService.download = originalDownload;
  }
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

test("TikTok staging diagnostics are strictly gated and keep one extraction execution", () => {
  assert.equal(shouldEnableTikTokStagingDiagnostics(false, "tiktok", "analyze"), false);
  assert.equal(shouldEnableTikTokStagingDiagnostics(true, "youtube", "analyze"), false);
  assert.equal(shouldEnableTikTokStagingDiagnostics(true, "tiktok", "process"), false);
  assert.equal(shouldEnableTikTokStagingDiagnostics(true, "tiktok", "analyze"), true);

  const normalPlan = buildAnalyzeExecutionPlan("https://tiktok.com/@public/video/1", false);
  const stagingPlan = buildAnalyzeExecutionPlan("https://tiktok.com/@public/video/1", true);
  assert.equal(normalPlan.length, 1);
  assert.equal(stagingPlan.length, 1);
  assert.equal(normalPlan[0].includes("--verbose"), false);
  assert.equal(stagingPlan[0].filter((arg) => arg === "--verbose").length, 1);
  assert.equal(stagingPlan[0].includes("--skip-download"), true);
  assert.equal(stagingPlan[0].some((arg) => /retry/i.test(arg)), false);
});

test("TikTok staging runtime diagnostics detect only allowlisted runtime facts", () => {
  const runtime = parseStagingRuntimeDiagnostics([
    "yt_dlp=2026.08.19",
    "curl_cffi=0.16.0",
    "impersonation_targets=37",
    "impersonation_backend=curl_cffi",
    "python_environment=venv",
    "SECRET=https://example.test/?token=secret",
  ].join("\n"));
  assert.deepEqual(runtime, {
    ytDlpVersion: "2026.08.19",
    curlCffiAvailable: true,
    curlCffiVersion: "0.16.0",
    impersonationTargetsCount: 37,
    impersonationBackend: "curl_cffi",
    pythonEnvironment: "venv",
  });
  assert.doesNotMatch(JSON.stringify(runtime), /SECRET|example\.test|token/i);
});

test("TikTok verbose diagnostics sanitize target families, redirects and HTTP status", () => {
  assert.equal(parseImpersonationTargetFamily("chrome-136:linux"), "chrome");
  assert.equal(parseImpersonationTargetFamily("safari-18:macos"), "safari");
  assert.equal(parseImpersonationTargetFamily("custom-1:linux"), "unknown");

  const stderr = [
    "[debug] [TikTok] Impersonation target: chrome-136:linux",
    "[redirect] Following redirect to https://private.example/path?token=secret",
    "WARNING Cookie: session=private Authorization: Bearer-private",
    "<html><body>private challenge body</body></html>",
    "ERROR: HTTP Error 403: Forbidden",
    "ERROR: Unexpected response from webpage request",
  ].join("\n");
  const parsed = parseTikTokVerboseDiagnostics(stderr);
  assert.deepEqual(parsed, {
    impersonationApplied: true,
    impersonationTargetFamily: "chrome",
    redirectOccurred: true,
    httpStatus: 403,
    extractionStage: "challenge_detection",
  });
  const serialized = JSON.stringify(parsed);
  for (const forbidden of ["private.example", "token", "cookie", "authorization", "bearer", "html", "stderr"]) {
    assert.doesNotMatch(serialized.toLowerCase(), new RegExp(forbidden));
  }
});

test("TikTok staging diagnostic contains only the closed sanitized schema", () => {
  const runtime = parseStagingRuntimeDiagnostics("yt_dlp=2026.08.19\ncurl_cffi=0.16.0\nimpersonation_targets=37\nimpersonation_backend=curl_cffi\npython_environment=venv");
  const diagnostic = buildTikTokStagingDiagnostic(
    runtime,
    "Cookie=secret Authorization=Bearer-secret https://tiktok.com/@private/video/1?token=x\n[debug] [TikTok] Impersonation target: safari-18:macos\nERROR: Unexpected response from webpage request",
    "unexpected_webpage_response",
    1200.4,
  );
  assert.deepEqual(Object.keys(diagnostic), [
    "provider", "stage", "ytDlpVersion", "curlCffiAvailable", "curlCffiVersion",
    "impersonationTargetsCount", "impersonationBackend", "pythonEnvironment",
    "impersonationRequested", "impersonationApplied", "impersonationTargetFamily",
    "redirectOccurred", "httpStatus", "extractionStage", "responseClassification",
    "metadataObtained", "rawFormatsCount", "usableFormatsCount", "durationMs",
  ]);
  assert.equal(diagnostic.impersonationTargetFamily, "safari");
  assert.equal(diagnostic.responseClassification, "unexpected_webpage_response");
  assert.equal(diagnostic.metadataObtained, false);
  const serialized = JSON.stringify(diagnostic).toLowerCase();
  for (const forbidden of ["secret", "authorization", "tiktok.com", "token=", "cookie", "stderr", "stdout"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden.replace(".", "\\.")));
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
  assert.deepEqual(classifyWarnings("WARNING: missing PO Token; SABR formats unavailable"), ["po_token_fetch_failed", "youtube_format_restriction", "formats_unavailable"]);
  assert.deepEqual(classifyWarnings("[debug] PO Token Providers: bgutil:http-2.0.0"), []);
  assert.deepEqual(classifyWarnings("WARNING: gvs PO Token obtained; subs PO Token failed"), [
    "po_token_fetch_failed", "po_token_available", "po_token_partially_available",
  ]);
  assert.deepEqual(classifyWarnings("WARNING: PO Token state is unclear"), ["po_token_status_unknown"]);
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

test("media staging Docker alone enables diagnostics and production Docker stays unconfigured", async () => {
  const [productionDockerfile, stagingDockerfile] = await Promise.all([
    readFile("Dockerfile", "utf8"),
    readFile("Dockerfile.media-staging", "utf8"),
  ]);
  assert.doesNotMatch(productionDockerfile, /MEDIA_STAGING_DIAGNOSTICS/);
  assert.match(stagingDockerfile, /MEDIA_STAGING_DIAGNOSTICS=true/);
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
