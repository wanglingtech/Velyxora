import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/db/prisma";
import {
  YouTubeCircuitBreakerRejectedError,
  YouTubeCircuitBreakerService,
  youtubeCircuitBreakerService,
} from "../src/services/youtubeCircuitBreakerService";
import { YouTubeProvider } from "../src/providers/YouTubeProvider";
import { providerRegistry } from "../src/providers/ProviderRegistry";
import { ytDlpService, YtDlpError, YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE } from "../src/services/ytDlpService";
import { ENV } from "../src/config/env";
import { mediaDownloadService } from "../src/services/mediaDownloadService";
import { mediaService } from "../src/services/mediaService";
import { creditLedgerService } from "../src/services/creditLedgerService";
import { jobManager } from "../src/jobs/JobManager";
import { mediaDownloadQueue, processMediaDownloadJob } from "../src/workers/mediaDownloadWorker";
import { storageService } from "../src/services/storageService";
import { logger } from "../src/utils/logger";
import { InMemoryQueue } from "../src/jobs/InMemoryQueue";

const clearCircuit = () => prisma.providerCircuitBreaker.deleteMany({ where: { provider: "youtube" } });
const row = () => prisma.providerCircuitBreaker.findUniqueOrThrow({ where: { provider: "youtube" } });

beforeEach(clearCircuit);
afterEach(clearCircuit);

test("YT-005C PostgreSQL threshold, window, success and neutral outcomes", { concurrency: false }, async () => {
  const service = new YouTubeCircuitBreakerService();
  const first = await service.acquire();
  await service.recordRestriction(first);
  assert.equal((await row()).state, "CLOSED");
  assert.equal((await row()).consecutiveRestrictions, 1);

  const second = await service.acquire();
  await service.recordRestriction(second);
  assert.equal((await row()).consecutiveRestrictions, 2);

  const neutral = await service.acquire();
  await service.recordNeutral(neutral);
  assert.equal((await row()).consecutiveRestrictions, 2);

  const success = await service.acquire();
  await service.recordSuccess(success);
  assert.equal((await row()).consecutiveRestrictions, 0);
  assert.equal((await row()).restrictionWindowStartedAt, null);

  const expired = await service.acquire();
  await service.recordRestriction(expired);
  await prisma.$executeRaw`
    UPDATE "ProviderCircuitBreaker"
    SET "restrictionWindowStartedAt" = CURRENT_TIMESTAMP - INTERVAL '11 minutes', "consecutiveRestrictions" = 2
    WHERE "provider" = 'youtube'
  `;
  const afterWindow = await service.acquire();
  await service.recordRestriction(afterWindow);
  assert.equal((await row()).consecutiveRestrictions, 1);

  for (let index = 0; index < 2; index += 1) {
    const permit = await service.acquire();
    await service.recordRestriction(permit);
  }
  assert.equal((await row()).state, "OPEN");
});

test("YT-005C PostgreSQL admits one distributed probe, recovers leases and ignores stale results", { concurrency: false }, async () => {
  const serviceA = new YouTubeCircuitBreakerService();
  const serviceB = new YouTubeCircuitBreakerService();
  const old = await serviceA.acquire();
  const permits = await Promise.all([serviceA.acquire(), serviceA.acquire(), serviceA.acquire()]);
  await Promise.all(permits.map((permit) => serviceA.recordRestriction(permit)));
  assert.equal((await row()).state, "OPEN");
  await serviceA.recordSuccess(old);
  assert.equal((await row()).state, "OPEN");

  await prisma.$executeRaw`UPDATE "ProviderCircuitBreaker" SET "cooldownUntil" = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE "provider" = 'youtube'`;
  const attempts = await Promise.allSettled([serviceA.acquire(), serviceB.acquire()]);
  assert.equal(attempts.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((entry) => entry.status === "rejected").length, 1);
  const firstProbe = attempts.find((entry): entry is PromiseFulfilledResult<any> => entry.status === "fulfilled")!.value;
  assert.equal(firstProbe.state, "HALF_OPEN");

  await prisma.$executeRaw`UPDATE "ProviderCircuitBreaker" SET "probeLeaseUntil" = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE "provider" = 'youtube'`;
  const replacement = await serviceB.acquire();
  assert.notEqual(replacement.probeToken, firstProbe.probeToken);
  await serviceA.recordSuccess(firstProbe);
  assert.equal((await row()).state, "HALF_OPEN");
  await serviceB.recordSuccess(replacement);
  const recovered = await row();
  assert.equal(recovered.state, "CLOSED");
  assert.equal(recovered.cooldownLevel, 0);
});

test("YT-005C probe restriction increases cooldown up to 120 minutes", { concurrency: false }, async () => {
  const service = new YouTubeCircuitBreakerService();
  for (let index = 0; index < 3; index += 1) {
    const permit = await service.acquire();
    await service.recordRestriction(permit);
  }
  for (let level = 1; level <= 4; level += 1) {
    await prisma.$executeRaw`UPDATE "ProviderCircuitBreaker" SET "cooldownUntil" = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE "provider" = 'youtube'`;
    const probe = await service.acquire();
    await service.recordRestriction(probe);
    assert.equal((await row()).cooldownLevel, Math.min(level, 3));
  }
  const current = await row();
  assert.ok(current.cooldownUntil!.getTime() - current.openedAt!.getTime() <= 120 * 60 * 1000 + 1000);
});

test("YT-005C OPEN fails before sidecar and yt-dlp and preserves public error", { concurrency: false }, async () => {
  await prisma.providerCircuitBreaker.create({
    data: { provider: "youtube", state: "OPEN", cooldownUntil: new Date(Date.now() + 60_000), openedAt: new Date() },
  });
  const originalFetch = globalThis.fetch;
  const originalAnalyze = ytDlpService.analyze;
  const originalLookup = dns.lookup;
  const originalReserve = creditLedgerService.reserve;
  let sidecarCalls = 0;
  let ytDlpCalls = 0;
  let reserveCalls = 0;
  const jobsBefore = jobManager.listJobs().length;
  const usagesBefore = await prisma.processingUsage.count();
  dns.lookup = (async () => [{ address: "142.250.0.1", family: 4 }]) as typeof dns.lookup;
  creditLedgerService.reserve = (async () => { reserveCalls += 1; throw new Error("unexpected"); }) as typeof creditLedgerService.reserve;
  globalThis.fetch = (async () => { sidecarCalls += 1; throw new Error("unexpected"); }) as typeof fetch;
  ytDlpService.analyze = (async () => { ytDlpCalls += 1; throw new Error("unexpected"); }) as typeof ytDlpService.analyze;
  try {
    await assert.rejects(
      () => new YouTubeProvider().analyze("https://youtube.com/watch?v=public"),
      (error: any) => error.code === "PROVIDER_TEMPORARILY_RESTRICTED" && error.message === YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE,
    );
    assert.equal(sidecarCalls, 0);
    assert.equal(ytDlpCalls, 0);
    await assert.rejects(() => mediaService.analyzeUrl("https://youtube.com/watch?v=public"), (error: any) => error.code === "PROVIDER_TEMPORARILY_RESTRICTED");
    assert.equal(reserveCalls, 0);
    assert.equal(jobManager.listJobs().length, jobsBefore);
    assert.equal(await prisma.processingUsage.count(), usagesBefore);
  } finally {
    globalThis.fetch = originalFetch;
    ytDlpService.analyze = originalAnalyze;
    dns.lookup = originalLookup;
    creditLedgerService.reserve = originalReserve;
  }
});

test("YT-005C blocked revalidate creates no job, reservation or enqueue", { concurrency: false }, async () => {
  await prisma.providerCircuitBreaker.create({ data: { provider: "youtube", state: "OPEN", cooldownUntil: new Date(Date.now() + 60_000), openedAt: new Date() } });
  const originalLookup = dns.lookup;
  const originalReserve = creditLedgerService.reserve;
  const originalSettle = creditLedgerService.settle;
  const originalAdd = mediaDownloadQueue.add;
  let reserves = 0;
  let settlements = 0;
  let enqueues = 0;
  const jobsBefore = jobManager.listJobs().length;
  dns.lookup = (async () => [{ address: "142.250.0.1", family: 4 }]) as typeof dns.lookup;
  creditLedgerService.reserve = (async () => { reserves += 1; throw new Error("unexpected"); }) as typeof creditLedgerService.reserve;
  creditLedgerService.settle = (async () => { settlements += 1; throw new Error("unexpected"); }) as typeof creditLedgerService.settle;
  mediaDownloadQueue.add = (async () => { enqueues += 1; }) as typeof mediaDownloadQueue.add;
  try {
    await assert.rejects(
      () => mediaDownloadService.start("https://youtube.com/watch?v=public", "18", "mp4", "video", "Public", { userId: "user", isAdmin: false }),
      (error: any) => error.code === "PROVIDER_TEMPORARILY_RESTRICTED",
    );
    assert.equal(reserves, 0);
    assert.equal(settlements, 0);
    assert.equal(enqueues, 0);
    assert.equal(jobManager.listJobs().length, jobsBefore);
  } finally {
    dns.lookup = originalLookup;
    creditLedgerService.reserve = originalReserve;
    creditLedgerService.settle = originalSettle;
    mediaDownloadQueue.add = originalAdd;
  }
});

test("YT-005C worker rejection fails and settles exactly once", { concurrency: false }, async () => {
  await prisma.providerCircuitBreaker.create({ data: { provider: "youtube", state: "OPEN", cooldownUntil: new Date(Date.now() + 60_000), openedAt: new Date() } });
  const originalSettle = creditLedgerService.settle;
  const id = `media-yt005c-${Date.now()}`;
  const settlements: string[] = [];
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "mp4", type: "video", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "FAILED");
    assert.equal(jobManager.getJob(id)?.error, YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE);
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    creditLedgerService.settle = originalSettle;
    jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-01 service settles exactly once when createJob fails after reserve", { concurrency: false }, async () => {
  const originalLookup = dns.lookup;
  const originalFind = providerRegistry.find;
  const originalReserve = creditLedgerService.reserve;
  const originalSettle = creditLedgerService.settle;
  const originalCreateJob = jobManager.createJob;
  const originalAdd = mediaDownloadQueue.add;
  const settlements: string[] = [];
  let reserves = 0;
  let enqueues = 0;
  dns.lookup = (async () => [{ address: "142.250.0.1", family: 4 }]) as typeof dns.lookup;
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    assertFormatAvailable: async () => undefined,
  })) as typeof providerRegistry.find;
  creditLedgerService.reserve = (async () => { reserves += 1; return {} as never; }) as typeof creditLedgerService.reserve;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  jobManager.createJob = (() => { throw new Error("create failed"); }) as typeof jobManager.createJob;
  mediaDownloadQueue.add = (async () => { enqueues += 1; }) as typeof mediaDownloadQueue.add;
  try {
    await assert.rejects(
      () => mediaDownloadService.start("https://youtube.com/watch?v=public", "18", "mp4", "video", "Public", { userId: "user", isAdmin: false }),
      /create failed/,
    );
    assert.equal(reserves, 1);
    assert.equal(enqueues, 0);
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    dns.lookup = originalLookup;
    providerRegistry.find = originalFind;
    creditLedgerService.reserve = originalReserve;
    creditLedgerService.settle = originalSettle;
    jobManager.createJob = originalCreateJob;
    mediaDownloadQueue.add = originalAdd;
  }
});

test("YT-005C FIX-01 service owns settlement until enqueue succeeds", { concurrency: false }, async () => {
  const originalLookup = dns.lookup;
  const originalFind = providerRegistry.find;
  const originalReserve = creditLedgerService.reserve;
  const originalSettle = creditLedgerService.settle;
  const originalCreateJob = jobManager.createJob;
  const originalAdd = mediaDownloadQueue.add;
  const settlements: string[] = [];
  const createdIds: string[] = [];
  dns.lookup = (async () => [{ address: "142.250.0.1", family: 4 }]) as typeof dns.lookup;
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    assertFormatAvailable: async () => undefined,
  })) as typeof providerRegistry.find;
  creditLedgerService.reserve = (async () => ({} as never)) as typeof creditLedgerService.reserve;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  jobManager.createJob = ((params) => {
    createdIds.push(params.id);
    return originalCreateJob.call(jobManager, params);
  }) as typeof jobManager.createJob;
  try {
    mediaDownloadQueue.add = (async () => { throw new Error("enqueue failed"); }) as typeof mediaDownloadQueue.add;
    await assert.rejects(
      () => mediaDownloadService.start("https://youtube.com/watch?v=public", "18", "mp4", "video", "Public", { userId: "user", isAdmin: false }),
      /enqueue failed/,
    );
    assert.deepEqual(settlements, ["FAILED"]);

    settlements.length = 0;
    mediaDownloadQueue.add = (async () => undefined) as typeof mediaDownloadQueue.add;
    const job = await mediaDownloadService.start("https://youtube.com/watch?v=public", "18", "mp4", "video", "Public", { userId: "user", isAdmin: false });
    assert.ok(job.id);
    assert.deepEqual(settlements, []);
  } finally {
    dns.lookup = originalLookup;
    providerRegistry.find = originalFind;
    creditLedgerService.reserve = originalReserve;
    creditLedgerService.settle = originalSettle;
    jobManager.createJob = originalCreateJob;
    mediaDownloadQueue.add = originalAdd;
    for (const id of createdIds) jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-01 worker settles when cleanup listing fails", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const originalReaddir = fs.readdirSync;
  const id = `media-yt005c-list-${Date.now()}`;
  const settlements: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { throw new Error("operation failed"); },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  fs.readdirSync = (() => { throw new Error("cleanup list failed"); }) as typeof fs.readdirSync;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "mp4", type: "video", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "FAILED");
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    fs.readdirSync = originalReaddir;
    jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-01 worker settles when cleanup unlink fails", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const originalReaddir = fs.readdirSync;
  const originalUnlink = fs.unlinkSync;
  const id = `media-yt005c-unlink-${Date.now()}`;
  const settlements: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { throw new Error("operation failed"); },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  fs.readdirSync = (() => [`download-${id}.part`]) as typeof fs.readdirSync;
  fs.unlinkSync = (() => { throw new Error("cleanup unlink failed"); }) as typeof fs.unlinkSync;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "mp4", type: "video", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "FAILED");
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    fs.readdirSync = originalReaddir;
    fs.unlinkSync = originalUnlink;
    jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-01 worker attempts settlement when FAILED status update throws", { concurrency: false }, async () => {
  const originalSettle = creditLedgerService.settle;
  const originalSetStatus = jobManager.setStatus;
  const id = `media-yt005c-status-${Date.now()}`;
  const settlements: string[] = [];
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  jobManager.setStatus = (() => { throw new Error("status failed"); }) as typeof jobManager.setStatus;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "mp4", type: "video", title: "Public", billingUserId: "user" });
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    creditLedgerService.settle = originalSettle;
    jobManager.setStatus = originalSetStatus;
    jobManager.deleteJob(id);
  }
});

function writeSilentWav(filePath: string): void {
  const sampleCount = 800;
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(filePath, wav);
}

test("YT-005C FIX-02 successful processing settles COMPLETED exactly once", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const id = `media-yt005c-success-${Date.now()}`;
  const outputPath = path.join(ENV.STORAGE_DIR, `download-${id}.wav`);
  const settlements: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { writeSilentWav(outputPath); return outputPath; },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "m4a", type: "audio", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "COMPLETED");
    assert.deepEqual(settlements, ["COMPLETED"]);
  } finally {
    const fileId = jobManager.getJob(id)?.output?.fileId;
    if (fileId) storageService.deleteFile(fileId);
    else if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-02 COMPLETED settlement failure never becomes FAILED", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const originalWarn = logger.warn;
  const originalSetStatus = jobManager.setStatus;
  const id = `media-yt005c-completed-settle-${Date.now()}`;
  const outputPath = path.join(ENV.STORAGE_DIR, `download-${id}.wav`);
  const settlements: string[] = [];
  const statuses: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { writeSilentWav(outputPath); return outputPath; },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); throw new Error("settlement unavailable"); }) as typeof creditLedgerService.settle;
  logger.warn = (() => { throw new Error("logger unavailable"); }) as typeof logger.warn;
  jobManager.setStatus = ((jobId, status, error) => {
    statuses.push(status);
    return originalSetStatus.call(jobManager, jobId, status, error);
  }) as typeof jobManager.setStatus;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "m4a", type: "audio", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "COMPLETED");
    assert.equal(statuses.includes("FAILED"), false);
    assert.deepEqual(settlements, ["COMPLETED"]);
  } finally {
    const fileId = jobManager.getJob(id)?.output?.fileId;
    if (fileId) storageService.deleteFile(fileId);
    else if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    logger.warn = originalWarn;
    jobManager.setStatus = originalSetStatus;
    jobManager.deleteJob(id);
  }
});


test("YT-005C FIX-02 status logger failure cannot turn successful processing into FAILED", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const originalInfo = logger.info;
  const id = `media-yt005c-info-${Date.now()}`;
  const outputPath = path.join(ENV.STORAGE_DIR, `download-${id}.wav`);
  const settlements: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { writeSilentWav(outputPath); return outputPath; },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  logger.info = (() => { throw new Error("logger unavailable"); }) as typeof logger.info;
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "m4a", type: "audio", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "COMPLETED");
    assert.deepEqual(settlements, ["COMPLETED"]);
  } finally {
    logger.info = originalInfo;
    const fileId = jobManager.getJob(id)?.output?.fileId;
    if (fileId) storageService.deleteFile(fileId);
    else if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    jobManager.deleteJob(id);
  }
});
test("YT-005C FIX-02 logger failure cannot block FAILED settlement", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const originalWarn = logger.warn;
  const id = `media-yt005c-logger-${Date.now()}`;
  const settlements: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { throw new Error("processing failed"); },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); return {} as never; }) as typeof creditLedgerService.settle;
  logger.warn = (() => { throw new Error("logger unavailable"); }) as typeof logger.warn;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "mp4", type: "video", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "FAILED");
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    logger.warn = originalWarn;
    jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-02 FAILED settlement and logging failures do not retry or loop", { concurrency: false }, async () => {
  const originalFind = providerRegistry.find;
  const originalSettle = creditLedgerService.settle;
  const originalWarn = logger.warn;
  const id = `media-yt005c-failed-settle-${Date.now()}`;
  const settlements: string[] = [];
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    download: async () => { throw new Error("processing failed"); },
  })) as typeof providerRegistry.find;
  creditLedgerService.settle = (async (_jobId, outcome) => { settlements.push(outcome); throw new Error("settlement unavailable"); }) as typeof creditLedgerService.settle;
  logger.warn = (() => { throw new Error("logger unavailable"); }) as typeof logger.warn;
  jobManager.createJob({ id, ownerId: "user", toolId: "media-downloader", input: { filename: "remote", originalName: "Public", mimeType: "application/octet-stream", size: 0, path: "" } });
  try {
    await processMediaDownloadJob(id, { url: "https://youtube.com/watch?v=public", formatId: "18", container: "mp4", type: "video", title: "Public", billingUserId: "user" });
    assert.equal(jobManager.getJob(id)?.status, "FAILED");
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    providerRegistry.find = originalFind;
    creditLedgerService.settle = originalSettle;
    logger.warn = originalWarn;
    jobManager.deleteJob(id);
  }
});

test("YT-005C FIX-03 add rejection before push leaves queue empty", { concurrency: false }, async () => {
  const queue = new InMemoryQueue("yt005c-pre-push", 1);
  (queue as any).queue = Object.freeze([]);
  await assert.rejects(() => queue.add("job-pre-push", {}), TypeError);
  assert.equal(await queue.getWaitingCount(), 0);
});

test("YT-005C FIX-03 post-push logger failure keeps add successful and processes once", { concurrency: false }, async () => {
  const queue = new InMemoryQueue("yt005c-post-push", 1);
  const originalDebug = logger.debug;
  const processed: string[] = [];
  let resolveProcessed!: () => void;
  const processedOnce = new Promise<void>((resolve) => { resolveProcessed = resolve; });
  queue.process(async (jobId) => {
    processed.push(jobId);
    resolveProcessed();
  });
  logger.debug = (() => { throw new Error("logger unavailable"); }) as typeof logger.debug;
  try {
    await queue.add("job-post-push", {});
    await processedOnce;
    assert.deepEqual(processed, ["job-post-push"]);
    assert.equal(await queue.getWaitingCount(), 0);
  } finally {
    logger.debug = originalDebug;
    await queue.close();
  }
});

test("YT-005C FIX-03 synchronous scheduling failure cannot contradict accepted enqueue", { concurrency: false }, async () => {
  const queue = new InMemoryQueue("yt005c-schedule", 1);
  const originalTick = (queue as any).tick;
  const processed: string[] = [];
  queue.process(async (jobId) => { processed.push(jobId); });
  (queue as any).tick = () => { throw new Error("scheduler unavailable"); };
  await queue.add("job-schedule", {});
  assert.equal(await queue.getWaitingCount(), 1);
  (queue as any).tick = originalTick;
  let resolveProcessed!: () => void;
  const processedOnce = new Promise<void>((resolve) => { resolveProcessed = resolve; });
  queue.process(async (jobId) => {
    processed.push(jobId);
    resolveProcessed();
  });
  await processedOnce;
  assert.deepEqual(processed, ["job-schedule"]);
  await queue.close();
});

test("YT-005C FIX-03 accepted enqueue transfers settlement ownership to worker", { concurrency: false }, async () => {
  const originalLookup = dns.lookup;
  const originalFind = providerRegistry.find;
  const originalReserve = creditLedgerService.reserve;
  const originalSettle = creditLedgerService.settle;
  const originalDebug = logger.debug;
  const settlements: string[] = [];
  let resolveSettlement!: () => void;
  const workerSettled = new Promise<void>((resolve) => { resolveSettlement = resolve; });
  dns.lookup = (async () => [{ address: "142.250.0.1", family: 4 }]) as typeof dns.lookup;
  providerRegistry.find = (() => ({
    platform: "youtube", name: "YouTube", canHandle: () => true, analyze: async () => { throw new Error("unused"); },
    assertFormatAvailable: async () => undefined,
    download: async () => { throw new Error("worker processing failed"); },
  })) as typeof providerRegistry.find;
  creditLedgerService.reserve = (async () => ({} as never)) as typeof creditLedgerService.reserve;
  creditLedgerService.settle = (async (_jobId, outcome) => {
    settlements.push(outcome);
    resolveSettlement();
    return {} as never;
  }) as typeof creditLedgerService.settle;
  logger.debug = (() => { throw new Error("logger unavailable"); }) as typeof logger.debug;
  let id: string | undefined;
  try {
    const job = await mediaDownloadService.start("https://youtube.com/watch?v=public", "18", "mp4", "video", "Public", { userId: "user", isAdmin: false });
    id = job.id;
    await workerSettled;
    assert.equal(jobManager.getJob(job.id)?.status, "FAILED");
    assert.deepEqual(settlements, ["FAILED"]);
  } finally {
    dns.lookup = originalLookup;
    providerRegistry.find = originalFind;
    creditLedgerService.reserve = originalReserve;
    creditLedgerService.settle = originalSettle;
    logger.debug = originalDebug;
    if (id) jobManager.deleteJob(id);
  }
});
test("YT-005C DB failure fails closed only for YouTube and emits safe events", { concurrency: false }, async () => {
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const brokenDb = { $transaction: async () => { throw new Error("secret database URL"); } };
  const broken = new YouTubeCircuitBreakerService(brokenDb as never, (event, fields) => events.push({ event, fields }));
  await assert.rejects(() => broken.acquire(), (error: any) => error instanceof YouTubeCircuitBreakerRejectedError && error.reason === "breaker_store_unavailable");

  const originalFetch = globalThis.fetch;
  const originalAnalyzeForFailure = ytDlpService.analyze;
  let sidecarCalls = 0;
  let youtubeCalls = 0;
  globalThis.fetch = (async () => { sidecarCalls += 1; throw new Error("unexpected"); }) as typeof fetch;
  ytDlpService.analyze = (async () => { youtubeCalls += 1; throw new Error("unexpected"); }) as typeof ytDlpService.analyze;
  try {
    await assert.rejects(
      () => new YouTubeProvider(broken).analyze("https://youtube.com/watch?v=public"),
      (error: any) => error.code === "PROVIDER_TEMPORARILY_RESTRICTED" && error.message === YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE,
    );
    assert.equal(sidecarCalls, 0);
    assert.equal(youtubeCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    ytDlpService.analyze = originalAnalyzeForFailure;
  }

  const service = new YouTubeCircuitBreakerService(prisma, (event, fields) => events.push({ event, fields }));
  for (let index = 0; index < 3; index += 1) await service.recordRestriction(await service.acquire());
  for (const entry of events) {
    assert.ok(["YOUTUBE_CIRCUIT_OPENED"].includes(entry.event));
    assert.doesNotMatch(JSON.stringify(entry), /url|videoId|user|stderr|token|cookie|header|sidecar|database/i);
  }
  assert.equal(ENV.NODE_ENV, "test");
  assert.ok(new YtDlpError("PROVIDER_TEMPORARILY_RESTRICTED", YOUTUBE_TEMPORARILY_RESTRICTED_MESSAGE));

  const originalAnalyze = ytDlpService.analyze;
  let otherProviderCalls = 0;
  ytDlpService.analyze = (async () => {
    otherProviderCalls += 1;
    return { url: "https://facebook.com/watch/1", platform: "facebook", title: "Public", formats: [], isDirectDownloadPossible: false, requiresExternalExtractor: true };
  }) as typeof ytDlpService.analyze;
  try {
    const { YtDlpProvider } = await import("../src/providers/YtDlpProvider");
    await new YtDlpProvider("facebook", "Facebook", [/facebook/]).analyze("https://facebook.com/watch/1");
    assert.equal(otherProviderCalls, 1);
  } finally {
    ytDlpService.analyze = originalAnalyze;
  }
});
