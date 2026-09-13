import test from "node:test";
import assert from "node:assert";
import { validateSafeUrl } from "../src/security/ssrfValidator";
import { assertSafePath } from "../src/utils/pathUtils";

test("SSRF Validator blocks loopback and private addresses", async () => {
  const loopbackResult = await validateSafeUrl("http://127.0.0.1:8080/admin");
  assert.strictEqual(loopbackResult.valid, false);
  assert.match(loopbackResult.error || "", /restricted/);

  const localHostResult = await validateSafeUrl("http://localhost:3000/api");
  assert.strictEqual(localHostResult.valid, false);

  const fileResult = await validateSafeUrl("file:///etc/passwd");
  assert.strictEqual(fileResult.valid, false);
  assert.match(fileResult.error || "", /protocol/);
});

test("SSRF Validator blocks private IPv6 and IPv4-mapped IPv6 addresses", async () => {
  for (const address of [
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
  ]) {
    const result = await validateSafeUrl(address);
    assert.strictEqual(result.valid, false, address);
  }
});

test("SSRF Validator allows legitimate public URLs", async () => {
  const youtubeResult = await validateSafeUrl(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.strictEqual(youtubeResult.valid, true);

  const vimeoResult = await validateSafeUrl("https://vimeo.com/76979871");
  assert.strictEqual(vimeoResult.valid, true);
});

test("Path Traversal protection blocks directory escape", () => {
  assert.throws(() => {
    assertSafePath(
      "/app/applet/backend/storage",
      "/app/applet/backend/storage/../../etc/passwd",
    );
  }, /Access denied to path outside boundary/);
});
