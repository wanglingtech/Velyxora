import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTURE_SEGMENT_HEIGHT,
  captureFilename,
  computeCaptureSegments,
  isMostlyBlankPixels,
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

test("el módulo HTML a capturas tiene ruta propia y es un destino de retorno seguro", () => {
  assert.deepEqual(routeFromPath("/webpage-capture"), { view: "webpage-capture" });
  assert.equal(pathForView("webpage-capture"), "/webpage-capture");
  assert.equal(sanitizeReturnTo("/webpage-capture"), "/webpage-capture");
});
