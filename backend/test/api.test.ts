import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import { backendApp } from "../src/app";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "../src/config/env";
import { storageService } from "../src/services/storageService";

test("GET /api/health returns valid health schema and dynamic service status", async () => {
  const res = await request(backendApp).get("/api/health");
  assert.strictEqual(res.status, 200);
  const body = res.body as any;
  assert.strictEqual(body.status, "ok");
  assert.ok(typeof body.services.ffmpeg === "boolean");
  assert.ok(typeof body.services.libreoffice === "boolean");
  assert.strictEqual(body.services.storage, true);
});

test("GET /api/tools returns available tool capabilities", async () => {
  const res = await request(backendApp).get("/api/tools");
  assert.strictEqual(res.status, 200);
  const body = res.body as any;
  assert.strictEqual(body.success, true);
  assert.ok(body.data.capabilities);
});

test("GET /api/formats returns format matrix for engines", async () => {
  const res = await request(backendApp).get("/api/formats");
  assert.strictEqual(res.status, 200);
  const body = res.body as any;
  assert.strictEqual(body.success, true);
  assert.ok(Array.isArray(body.data.engines));
});

test("POST /api/media/analyze rejects unsupported providers deterministically", async () => {
  const res = await request(backendApp)
    .post("/api/media/analyze")
    .send({ url: "https://example.com/video" });
  assert.strictEqual(res.status, 422);
  const body = res.body as any;
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error.code, "ANALYSIS_FAILED");
});

test("POST /api/media/analyze validates malformed input", async () => {
  const res = await request(backendApp).post("/api/media/analyze").send({ url: "not-a-url" });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
});

test("upload stores a real fixture and rejects a conversion with an unsupported route", async () => {
  const fixture = Buffer.from("real fixture bytes");
  const upload = await request(backendApp)
    .post("/api/uploads")
    .attach("file", fixture, { filename: "fixture.txt", contentType: "text/plain" });
  assert.strictEqual(upload.status, 201);
  assert.ok(upload.body.data.fileId);
  try {
    const conversion = await request(backendApp).post("/api/conversions").send({
      fileId: upload.body.data.fileId,
      toolId: "unsupported-test",
      targetFormat: "mp3",
    });
    assert.strictEqual(conversion.status, 422);
    assert.strictEqual(conversion.body.success, false);
  } finally {
    storageService.deleteFile(upload.body.data.fileId);
  }
});

test("backend download returns exact bytes and attachment headers", async () => {
  const fileId = `download-test-${Date.now()}`;
  const filename = `${fileId}.png`;
  const fullPath = path.join(ENV.STORAGE_DIR, filename);
  const fixture = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  fs.writeFileSync(fullPath, fixture);
  try {
    const res = await request(backendApp).get(`/api/download/${fileId}`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers["content-type"], /image\/png/);
    assert.match(res.headers["content-disposition"], /attachment/);
    assert.strictEqual(Number(res.headers["content-length"]), fixture.length);
  } finally {
    fs.unlinkSync(fullPath);
  }
});
