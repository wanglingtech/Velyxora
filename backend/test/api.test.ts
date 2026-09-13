import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import { backendApp } from "../src/app";

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
