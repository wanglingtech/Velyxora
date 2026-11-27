import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTURE_SEGMENT_HEIGHT,
  captureFilename,
  computeCaptureSegments,
  isMostlyBlankPixels,
<<<<<<< HEAD
  resolveCaptureRegion,
=======
>>>>>>> origin/main
} from "../src/services/webpageCaptureService";
import { pathForView, routeFromPath, sanitizeReturnTo } from "../src/services/appRouting";

test("computeCaptureSegments divide la página y respeta el tope de pantallas", () => {
  assert.deepEqual(computeCaptureSegments(0, 1400), [{ index: 0, top: 0, height: 1 }]);
  assert.deepEqual(computeCaptureSegments(1400, 1400), [{ index: 0, top: 0, height: 1400 }]);
  assert.deepEqual(computeCaptureSegments(1401, 1400), [
    { index: 0, top: 0, height: 1400 },
    { index: 1, top: 1400, height: 1 },
  ]);

  const capped = computeCaptureSegments(100_000, CAPTURE_SEGMENT_HEIGHT, 3);
  assert.equal(capped.length, 3);
  assert.deepEqual(capped.map((segment) => segment.top), [0, CAPTURE_SEGMENT_HEIGHT, CAPTURE_SEGMENT_HEIGHT * 2]);
  assert.ok(capped.every((segment) => segment.height > 0 && segment.height <= CAPTURE_SEGMENT_HEIGHT));
});

test("isMostlyBlankPixels detecta pantallas planas y conserva las que tienen contenido", () => {
  const flat = new Uint8ClampedArray(64 * 4).fill(255);
  assert.equal(isMostlyBlankPixels(flat), true);
  assert.equal(isMostlyBlankPixels(new Uint8ClampedArray(0)), true);

  const withContent = new Uint8ClampedArray(64 * 4).fill(255);
  withContent[0] = 0;
  withContent[1] = 0;
  withContent[2] = 0;
  assert.equal(isMostlyBlankPixels(withContent), false);
});

test("captureFilename usa la extensión real del formato elegido", () => {
  assert.equal(captureFilename(0, "image/png"), "pagina-01.png");
  assert.equal(captureFilename(9, "image/jpeg"), "pagina-10.jpg");
  assert.equal(captureFilename(2, "image/webp"), "pagina-03.webp");
});

<<<<<<< HEAD
test("resolveCaptureRegion devuelve la página completa sin recorte", () => {
  assert.deepEqual(resolveCaptureRegion(1280, 4000, null), { x: 0, y: 0, width: 1280, height: 4000 });
  assert.deepEqual(resolveCaptureRegion(1280, 4000), { x: 0, y: 0, width: 1280, height: 4000 });
});

test("resolveCaptureRegion recorta y limita el área seleccionada", () => {
  assert.deepEqual(
    resolveCaptureRegion(1280, 4000, { x: 100, y: 200, width: 500, height: 900 }),
    { x: 100, y: 200, width: 500, height: 900 },
  );

  // Out-of-bounds selections are clamped to the page.
  assert.deepEqual(
    resolveCaptureRegion(1280, 4000, { x: 1200, y: 3900, width: 900, height: 900 }),
    { x: 1200, y: 3900, width: 80, height: 100 },
  );

  // Negative/zero sizes fall back to at least one pixel.
  assert.deepEqual(
    resolveCaptureRegion(1280, 4000, { x: -50, y: -50, width: 0, height: 0 }),
    { x: 0, y: 0, width: 1, height: 1 },
  );
});

=======
>>>>>>> origin/main
test("el módulo HTML a capturas tiene ruta propia y es un destino de retorno seguro", () => {
  assert.deepEqual(routeFromPath("/webpage-capture"), { view: "webpage-capture" });
  assert.equal(pathForView("webpage-capture"), "/webpage-capture");
  assert.equal(sanitizeReturnTo("/webpage-capture"), "/webpage-capture");
});
