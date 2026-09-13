import test from "node:test";
import assert from "node:assert/strict";
import { uploadAndStartConversion } from "../src/services/backendConversionService";

test("Video to GIF forwards data.fileId from upload into startConversion", async () => {
  const expectedFileId = "file-1234-safe";
  let received: Record<string, unknown> | undefined;
  const client = {
    async uploadFile() {
      return {
        fileId: expectedFileId,
        filename: "stored.mp4",
        originalName: "clip.final.mp4",
        size: 42,
        mimeType: "video/mp4",
        expiresInMinutes: 30,
      };
    },
    async startConversion(params: Record<string, unknown>) {
      received = params;
      return { id: "job-1", toolId: "video-to-gif", status: "QUEUED" as const, progress: 0 };
    },
  };

  await uploadAndStartConversion(
    {} as File,
    { toolId: "video-to-gif", targetFormat: "gif", options: { gifWidth: 480, fps: 15 } },
    undefined,
    client,
  );

  assert.deepEqual(received, {
    fileId: expectedFileId,
    toolId: "video-to-gif",
    targetFormat: "gif",
    options: { gifWidth: 480, fps: 15 },
  });
});

test("conversion is not started when upload omits data.fileId", async () => {
  let started = false;
  const client = {
    async uploadFile() {
      return { filename: "stored.mp4" } as never;
    },
    async startConversion() {
      started = true;
      return { id: "job-1", toolId: "video-to-gif", status: "QUEUED" as const, progress: 0 };
    },
  };

  await assert.rejects(
    uploadAndStartConversion({} as File, { toolId: "video-to-gif", targetFormat: "gif" }, undefined, client),
    /UPLOAD_INVALID_RESPONSE/,
  );
  assert.strictEqual(started, false);
});
