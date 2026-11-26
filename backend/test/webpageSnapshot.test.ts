import assert from "node:assert/strict";
import test from "node:test";
import {
  WebpageFetchError,
  fetchWebpageAsset,
  fetchWebpageSnapshot,
  sanitizeSnapshotHtml,
} from "../src/services/webpageSnapshotService";
import {
  MAX_CAPTURE_PIXEL_HEIGHT,
  MAX_CAPTURE_PIXEL_WIDTH,
  clampCaptureGeometry,
  isBrowserCaptureAvailable,
} from "../src/services/browserCaptureService";

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

test("el snapshot elimina scripts para que la vista previa no ensucie la consola", () => {
  const html = sanitizeSnapshotHtml(
    '<html><head><script>window.x=1</script></head><body><script src="https://cdn.example/app.js"></script><noscript>off</noscript><p>Hola</p></body></html>',
    "https://example.com/",
  );
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<\/script>/i);
  assert.doesNotMatch(html, /cdn\.example\/app\.js/);
  assert.doesNotMatch(html, /<noscript/i);
  assert.match(html, /<p>Hola<\/p>/);
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

test("la captura con navegador mantiene el raster dentro de límites", () => {
  assert.deepEqual(clampCaptureGeometry(1280, 2000, 1), { width: 1280, height: 2000, scale: 1 });
  assert.deepEqual(clampCaptureGeometry(100, 50, 2), { width: 320, height: 200, scale: 2 });
  assert.deepEqual(clampCaptureGeometry(Number.NaN, Number.NaN, Number.NaN), {
    width: 1280,
    height: 900,
    scale: 1,
  });

  const huge = clampCaptureGeometry(2400, 16000, 3);
  assert.equal(huge.width, 2400);
  assert.equal(huge.height, 16000);
  assert.equal(huge.scale, 1);
  assert.ok(huge.width * huge.scale <= MAX_CAPTURE_PIXEL_WIDTH);
  assert.ok(huge.height * huge.scale <= MAX_CAPTURE_PIXEL_HEIGHT);

  const tall = clampCaptureGeometry(1280, 16000, 3);
  assert.ok(tall.scale <= 1);
  assert.equal(typeof isBrowserCaptureAvailable(), "boolean");
});
