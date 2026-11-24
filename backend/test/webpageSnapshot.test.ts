import assert from "node:assert/strict";
import test from "node:test";
import {
  WebpageFetchError,
  fetchWebpageAsset,
  fetchWebpageSnapshot,
  sanitizeSnapshotHtml,
} from "../src/services/webpageSnapshotService";

test("el snapshot inyecta una base segura y elimina navegación automática", () => {
  const html = sanitizeSnapshotHtml(
    '<html><head><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example"><title>Hola</title></head><body>x</body></html>',
    'https://example.com/a?b=1&c="2"',
  );
  assert.doesNotMatch(html, /evil\.example/);
  assert.match(html, /<base href="https:\/\/example\.com\/a\?b=1&amp;c=&quot;2&quot;">/);
  assert.equal((html.match(/<base/g) || []).length, 1);
});

test("el snapshot funciona cuando el HTML no declara <head>", () => {
  const html = sanitizeSnapshotHtml("<p>Hola</p>", "https://example.com/");
  assert.ok(html.startsWith('<base href="https://example.com/">'));
});

test("las URLs no http(s) se rechazan antes de salir a la red", async () => {
  await assert.rejects(() => fetchWebpageSnapshot("ftp://example.com/page"), (error: unknown) => {
    assert.ok(error instanceof WebpageFetchError);
    assert.equal(error.code, "URL_NOT_ALLOWED");
    return true;
  });
  await assert.rejects(() => fetchWebpageAsset("javascript:alert(1)"), (error: unknown) => {
    assert.ok(error instanceof WebpageFetchError);
    assert.equal(error.code, "URL_NOT_ALLOWED");
    return true;
  });
});

test("los hosts privados siguen bloqueados para snapshots", async () => {
  await assert.rejects(() => fetchWebpageSnapshot("http://localhost:3000/"), (error: unknown) => {
    assert.ok(error instanceof WebpageFetchError);
    assert.equal(error.code, "URL_NOT_ALLOWED");
    return true;
  });
});
