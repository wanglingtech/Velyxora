import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  PDF_MERGE_MAX_FILES,
  extractPdfPages,
  getPdfPageCount,
  mergePdfs,
  parsePdfPageRange,
  splitPdfIntoZip,
} from "../src/services/pdfEngine";
import {
  PLANNED_TOOL_REGISTRY,
  getToolById,
  getToolRunnerKind,
} from "../src/registry/tools";
import {
  PDF_IMAGE_MAX_PAGES,
  PDF_IMAGE_MAX_PIXELS,
  clampPdfRenderScale,
  getPdfImageFormat,
  getPdfImageResolution,
  pdfImageFilename,
  pdfImagesZipFilename,
  resolvePdfImagePages,
} from "../src/services/pdfImagePlan";

const makePdf = async (pages: number, name = "fixture.pdf"): Promise<File> => {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index++) document.addPage([200, 200]);
  return new File([await document.save()], name, { type: "application/pdf" });
};

test("parsePdfPageRange interpreta rangos válidos en índices 0-based", () => {
  assert.deepEqual(parsePdfPageRange("1-3,5", 10), [0, 1, 2, 4]);
  assert.deepEqual(parsePdfPageRange("-3", 5), [0, 1, 2]);
  assert.deepEqual(parsePdfPageRange("8-", 10), [7, 8, 9]);
  assert.deepEqual(parsePdfPageRange("2", 3), [1]);
  assert.deepEqual(parsePdfPageRange("3,1,3", 4), [0, 2]);
});

test("parsePdfPageRange rechaza entradas inválidas o fuera de límites", () => {
  for (const [input, count] of [["0", 3], ["4-2", 3], ["a", 3], ["9-", 3], ["", 3]] as const) {
    assert.throws(() => parsePdfPageRange(input, count), /páginas|rango|página/i);
  }
});

test("mergePdfs une documentos y valida entradas", async () => {
  const merged = await mergePdfs([await makePdf(2, "a.pdf"), await makePdf(1, "b.pdf")]);
  assert.equal(merged.type, "application/pdf");
  assert.equal(await getPdfPageCount(merged), 3);

  await assert.rejects(
    () => mergePdfs([new File([new Uint8Array([1, 2, 3])], "bad.pdf", { type: "application/pdf" })]),
    /válido|leerse/i,
  );
  await assert.rejects(
    () => mergePdfs([new File([new Uint8Array([1, 2, 3])], "bad.txt", { type: "text/plain" })]),
    /no es un PDF/i,
  );
  await assert.rejects(
    () => mergePdfs(Array.from({ length: PDF_MERGE_MAX_FILES + 1 }, () => new Blob([], { type: "application/pdf" }))),
    /hasta/i,
  );
});

test("extractPdfPages extrae solo las páginas indicadas", async () => {
  const source = await makePdf(3, "source.pdf");
  const extracted = await extractPdfPages(source, [0, 2]);
  assert.equal(await getPdfPageCount(extracted), 2);
  await assert.rejects(() => extractPdfPages(source, []), /al menos una página/i);
  await assert.rejects(() => extractPdfPages(source, [5]), /excede/i);
});

test("splitPdfIntoZip genera un PDF por página dentro de un ZIP", async () => {
  const blob = await splitPdfIntoZip(await makePdf(2, "split.pdf"), "velyxora");
  assert.equal(blob.type, "application/zip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entries = Object.keys(zip.files);
  assert.equal(entries.length, 2);
  assert.ok(entries.every((name) => name.endsWith(".pdf")));
});

test("merge-pdf y split-pdf son públicas, cliente y del runner pdf", () => {
  const plannedIds = new Set(PLANNED_TOOL_REGISTRY.map((tool) => tool.id));
  for (const id of ["merge-pdf", "split-pdf"]) {
    const tool = getToolById(id);
    assert.ok(tool, `${id} debe ser pública`);
    assert.equal(tool!.category, "pdf", `${id} debe usar la categoría pdf`);
    assert.equal(tool!.processingMode, "CLIENT_SIDE", `${id} debe ser CLIENT_SIDE`);
    assert.equal(Boolean(tool!.requiresServer), false, `${id} no debe requerir backend`);
    assert.equal(getToolRunnerKind(tool!), "pdf", `${id} debe resolver al runner pdf`);
    assert.equal(plannedIds.has(id), false, `${id} no debe seguir como planificada`);
  }
});

test("pdf-to-images es pública, cliente y del runner pdf", () => {
  const tool = getToolById("pdf-to-images");
  assert.ok(tool, "pdf-to-images debe ser pública");
  assert.equal(tool!.category, "pdf");
  assert.equal(tool!.processingMode, "CLIENT_SIDE");
  assert.equal(Boolean(tool!.requiresServer), false);
  assert.equal(getToolRunnerKind(tool!), "pdf");
  assert.equal(
    PLANNED_TOOL_REGISTRY.some((planned) => planned.id === "pdf-to-images"),
    false,
    "pdf-to-images ya no debe estar planificada",
  );
});

test("el plan de PDF a imágenes limita tamaño, páginas y nombres", () => {
  assert.equal(resolvePdfImagePages("1-3,5", 10).length, 4);
  assert.throws(() => resolvePdfImagePages("1-", PDF_IMAGE_MAX_PAGES + 1), /hasta/i);

  const scale = clampPdfRenderScale(4000, 4000, 4);
  assert.ok(scale < 4, "un póster enorme debe reducirse");
  assert.ok(4000 * scale * (4000 * scale) <= PDF_IMAGE_MAX_PIXELS + 1);
  assert.equal(clampPdfRenderScale(10, 10, 0.01), 0.25);

  assert.equal(pdfImageFilename(3, "png"), "pagina-03.png");
  assert.equal(pdfImageFilename(12, "jpeg"), "pagina-12.jpg");
  assert.equal(pdfImageFilename(7, "webp"), "pagina-07.webp");
  assert.equal(pdfImagesZipFilename("Mi Documento.pdf"), "Mi-Documento-paginas.zip");
  assert.equal(pdfImagesZipFilename(""), "documento-paginas.zip");
  assert.equal(getPdfImageFormat("webp").mime, "image/webp");
  assert.equal(getPdfImageResolution("alta").scale, 150 / 72);
});
