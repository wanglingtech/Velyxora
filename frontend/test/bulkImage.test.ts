import assert from "node:assert/strict";
import test from "node:test";
import {
  BULK_IMAGE_FORMAT_OPTIONS,
  baseNameFromImageUrl,
  bulkItemFilename,
  createBulkImageItem,
  extensionFromImageUrl,
  isLikelyImageUrl,
  normalizeImageUrl,
  parseBulkImageUrls,
  uniqueFilename,
} from "../src/services/bulkImageService";
import { pathForView, routeFromPath, sanitizeReturnTo } from "../src/services/appRouting";

test("normalizeImageUrl acepta http(s), añade https y rechaza esquemas peligrosos", () => {
  assert.equal(normalizeImageUrl(" https://cdn.example.com/foto.png "), "https://cdn.example.com/foto.png");
  assert.equal(normalizeImageUrl("www.example.com/foto.jpg"), "https://www.example.com/foto.jpg");
  assert.equal(normalizeImageUrl("example.com/a.webp"), "https://example.com/a.webp");
  assert.equal(normalizeImageUrl("javascript:alert(1)"), null);
  assert.equal(normalizeImageUrl("ftp://example.com/a.png"), null);
  assert.equal(normalizeImageUrl("   "), null);
});

test("parseBulkImageUrls separa por líneas, comas y espacios sin duplicados", () => {
  const urls = parseBulkImageUrls(
    "https://a.com/1.jpg\nhttps://a.com/2.png, https://a.com/3.webp https://a.com/1.jpg\nno-es-url",
  );
  assert.deepEqual(urls, [
    "https://a.com/1.jpg",
    "https://a.com/2.png",
    "https://a.com/3.webp",
  ]);
});

test("extensionFromImageUrl reconoce imágenes reales y usa fallback para el resto", () => {
  assert.equal(extensionFromImageUrl("https://a.com/foto.JPEG"), "jpg");
  assert.equal(extensionFromImageUrl("https://a.com/foto.png?token=1"), "png");
  assert.equal(extensionFromImageUrl("https://a.com/archivo.exe"), "jpg");
  assert.equal(extensionFromImageUrl("https://a.com/descarga"), "jpg");
  assert.equal(extensionFromImageUrl("https://a.com/descarga", "webp"), "webp");
  assert.equal(isLikelyImageUrl("https://a.com/foto.avif"), true);
  assert.equal(isLikelyImageUrl("https://a.com/video.mp4"), false);
});

test("baseNameFromImageUrl genera nombres seguros y legibles", () => {
  assert.equal(baseNameFromImageUrl("https://a.com/Mi%20Foto%20Final.PNG"), "Mi-Foto-Final");
  assert.equal(baseNameFromImageUrl("https://a.com/a/"), "a");
  assert.equal(baseNameFromImageUrl("https://a.com/", 2), "imagen-3");
});

test("el formato por elemento decide la extensión final sin alterar el original", () => {
  const item = createBulkImageItem("https://a.com/foto.webp", "image/png", 0);
  assert.equal(item.status, "pending");
  assert.equal(item.baseName, "foto");
  assert.equal(bulkItemFilename(item), "foto.png");

  const original = createBulkImageItem("https://a.com/foto.jpeg", "original", 1);
  assert.equal(bulkItemFilename(original), "foto.jpg");

  const ids = new Set([
    item.id,
    original.id,
    createBulkImageItem("https://a.com/foto.webp").id,
  ]);
  assert.equal(ids.size, 3, "cada elemento debe tener un id único");
});

test("uniqueFilename evita colisiones dentro del ZIP", () => {
  const used = new Set<string>();
  assert.equal(uniqueFilename("foto.jpg", used), "foto.jpg");
  assert.equal(uniqueFilename("foto.jpg", used), "foto-2.jpg");
  assert.equal(uniqueFilename("FOTO.jpg", used), "FOTO-3.jpg");
});

test("las opciones de formato del lote son únicas y cubren los formatos convertibles", () => {
  const values = BULK_IMAGE_FORMAT_OPTIONS.map((option) => option.value);
  assert.deepEqual(values, ["original", "image/png", "image/jpeg", "image/webp"]);
  assert.equal(new Set(values).size, values.length);
});

test("el módulo de descarga masiva tiene ruta propia y es un destino de retorno seguro", () => {
  assert.deepEqual(routeFromPath("/image-downloader"), { view: "image-downloader" });
  assert.equal(pathForView("image-downloader"), "/image-downloader");
  assert.equal(sanitizeReturnTo("/image-downloader"), "/image-downloader");
});
