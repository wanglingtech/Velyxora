import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STICKER_EDIT,
  generateSticker,
  renderStickerCanvas,
  STICKER_FILENAME,
  STICKER_LIMITS,
  stickerDrawRect,
  validateAndDecodeStickerImage,
} from "../src/services/stickerMakerService";
import { shareResult } from "../src/services/shareService";

const signatures: Record<string, number[]> = {
  "image/png": [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0],
  "image/jpeg": [255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0],
  "image/webp": [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80],
};
const file = (type: string, name = "input") => new File([new Uint8Array(signatures[type] || [1, 2, 3])], name, { type });
const decode = async () => ({ source: {} as CanvasImageSource, width: 1200, height: 800 });

function canvasWithSizes(sizes: number[]) {
  const calls: { clear: number; draw: unknown[][]; qualities: number[] } = { clear: 0, draw: [], qualities: [] };
  const context = {
    clearRect: () => { calls.clear += 1; },
    drawImage: (...args: unknown[]) => { calls.draw.push(args); },
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  };
  let index = 0;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback: (blob: Blob | null) => void, type: string, quality: number) => {
      calls.qualities.push(quality);
      callback(new Blob([new Uint8Array(sizes[Math.min(index++, sizes.length - 1)])], { type }));
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

test("acepta PNG, JPEG y WebP auténticos y decodificables", async () => {
  for (const type of Object.keys(signatures)) {
    const image = await validateAndDecodeStickerImage(file(type, `imagen.${type.split("/")[1]}`), decode);
    assert.deepEqual([image.width, image.height], [1200, 800]);
  }
});

test("rechaza MIME ajeno, firma falsa y archivo corrupto", async () => {
  await assert.rejects(validateAndDecodeStickerImage(new File(["html"], "x.html", { type: "text/html" }), decode), /MIME_UNSUPPORTED/);
  await assert.rejects(validateAndDecodeStickerImage(new File(["fake"], "x.png", { type: "image/png" }), decode), /SIGNATURE_INVALID/);
  await assert.rejects(validateAndDecodeStickerImage(file("image/png"), async () => { throw new Error("decode"); }), /IMAGE_CORRUPT/);
});

test("aplica límites de bytes, dimensiones y píxeles", async () => {
  const oversized = new File([new Uint8Array(STICKER_LIMITS.maxInputBytes + 1)], "huge.png", { type: "image/png" });
  await assert.rejects(validateAndDecodeStickerImage(oversized, decode), /INPUT_TOO_LARGE/);
  await assert.rejects(validateAndDecodeStickerImage(file("image/png"), async () => ({ source: {} as CanvasImageSource, width: 9000, height: 100 })), /DIMENSIONS_TOO_LARGE/);
  await assert.rejects(validateAndDecodeStickerImage(file("image/png"), async () => ({ source: {} as CanvasImageSource, width: 7000, height: 7000 })), /DIMENSIONS_TOO_LARGE/);
});

test("crop cuadrado responde a zoom, posición y reset", () => {
  assert.deepEqual(stickerDrawRect(1024, 512, DEFAULT_STICKER_EDIT), { x: -256, y: 0, width: 1024, height: 512 });
  const changed = stickerDrawRect(1024, 512, { zoom: 2, offsetX: 30, offsetY: -20 });
  assert.deepEqual(changed, { x: -738, y: -276, width: 2048, height: 1024 });
  assert.equal(DEFAULT_STICKER_EDIT.zoom, 1);
  assert.equal(DEFAULT_STICKER_EDIT.offsetX, 0);
});

test("renderiza sobre transparencia sin pintar un fondo opaco", () => {
  const { canvas, calls } = canvasWithSizes([1000]);
  renderStickerCanvas(canvas, { source: {} as CanvasImageSource, width: 800, height: 1200 }, DEFAULT_STICKER_EDIT);
  assert.equal(canvas.width, 512); assert.equal(canvas.height, 512);
  assert.equal(calls.clear, 1); assert.equal(calls.draw.length, 1);
  assert.equal("fillRect" in (canvas.getContext("2d") as object), false);
});

test("genera File WebP 512×512 y comprime hasta <=100 KB cuando es alcanzable", async () => {
  const { canvas, calls } = canvasWithSizes([180_000, 130_000, 90_000]);
  const result = await generateSticker({ source: {} as CanvasImageSource, width: 800, height: 600 }, DEFAULT_STICKER_EDIT, () => canvas);
  assert.equal(result.compatible, true); assert.equal(result.blob.type, "image/webp");
  assert.equal(result.file.type, "image/webp"); assert.equal(result.file.name, STICKER_FILENAME);
  assert.deepEqual([result.width, result.height, result.attempts], [512, 512, 3]);
  assert.deepEqual(calls.qualities, [0.92, 0.82, 0.72]);
});

test("se detiene en calidad mínima y marca fuera de objetivo cuando no llega a 100 KB", async () => {
  const { canvas, calls } = canvasWithSizes([150_000]);
  const result = await generateSticker({ source: {} as CanvasImageSource, width: 500, height: 500 }, DEFAULT_STICKER_EDIT, () => canvas);
  assert.equal(result.compatible, false);
  assert.equal(result.attempts, STICKER_LIMITS.qualities.length);
  assert.equal(calls.qualities.at(-1), STICKER_LIMITS.qualities.at(-1));
});

test("integra el File con Share Layer y respeta canShare", async () => {
  const { canvas } = canvasWithSizes([80_000]);
  const result = await generateSticker({ source: {} as CanvasImageSource, width: 500, height: 500 }, DEFAULT_STICKER_EDIT, () => canvas);
  let shared: ShareData | undefined;
  const outcome = await shareResult({ kind: "file", getFile: async () => result.file, download: () => assert.fail("no fallback") }, {
    canShare: (data) => data.files?.[0]?.name === STICKER_FILENAME,
    share: async (data) => { shared = data; },
  });
  assert.deepEqual(outcome, { status: "shared" });
  assert.equal(shared?.files?.[0]?.type, "image/webp");
});

test("Share Layer conserva descarga como fallback", async () => {
  let downloads = 0;
  const outcome = await shareResult({ kind: "file", getFile: async () => assert.fail("no debe crear File"), download: () => { downloads += 1; } }, {});
  assert.deepEqual(outcome, { status: "fallback", action: "download" });
  assert.equal(downloads, 1);
});

test("el servicio local no realiza llamadas backend ni consume créditos", async () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches += 1; throw new Error("unexpected fetch"); };
  try {
    const image = await validateAndDecodeStickerImage(file("image/webp"), decode);
    const { canvas } = canvasWithSizes([50_000]);
    await generateSticker(image, DEFAULT_STICKER_EDIT, () => canvas);
    assert.equal(fetches, 0);
  } finally { globalThis.fetch = originalFetch; }
});
