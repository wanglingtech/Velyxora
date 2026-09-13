import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  createPdfFromImages,
  createPdfFromText,
} from "../src/services/pdfEngine";

const assertPdfBlob = async (blob: Blob): Promise<PDFDocument> => {
  assert.equal(blob.type, "application/pdf");
  assert.ok(blob.size > 0);
  const header = new TextDecoder().decode(
    new Uint8Array(await blob.arrayBuffer()).slice(0, 5),
  );
  assert.equal(header, "%PDF-");
  return PDFDocument.load(await blob.arrayBuffer());
};

test("createPdfFromText creates a valid multipage PDF", async () => {
  const text = Array.from(
    { length: 180 },
    (_, index) =>
      `Línea ${index + 1}: contenido de prueba para verificar el ajuste de texto y la paginación automática.`,
  ).join("\n");
  const blob = await createPdfFromText("Documento de prueba", text, {
    pageSize: "Letter",
  });
  const document = await assertPdfBlob(blob);
  assert.ok(document.getPageCount() > 1);
});

test("createPdfFromImages creates a valid PDF from a PNG fixture", async () => {
  const pngBytes = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const image = new File([pngBytes], "fixture.png", { type: "image/png" });
  const blob = await createPdfFromImages([image], {
    pageSize: "A4",
    orientation: "portrait",
    margin: 20,
  });
  const document = await assertPdfBlob(blob);
  assert.equal(document.getPageCount(), 1);
});

test("createPdfFromImages rejects unsupported image formats", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "fixture.gif", {
    type: "image/gif",
  });
  await assert.rejects(
    () => createPdfFromImages([file]),
    /Formato no compatible/,
  );
});
