import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { ENV } from "../src/config/env";
import { LibreOfficeEngine } from "../src/engines/LibreOfficeEngine";

const configured = process.env.LIBREOFFICE_PATH || (process.platform === "win32" ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe" : "soffice");

async function makeDocx(target: string) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>VELYXORA LibreOffice integration</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
  fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
}

test("detecta de forma real un ejecutable ausente", async () => {
  const original = ENV.LIBREOFFICE_PATH;
  ENV.LIBREOFFICE_PATH = path.join(os.tmpdir(), "velyxora-missing-soffice");
  try { assert.equal(await new LibreOfficeEngine().isAvailable(true), false); }
  finally { ENV.LIBREOFFICE_PATH = original; }
});

test("solo permite rutas Office a PDF", () => {
  const engine = new LibreOfficeEngine();
  assert.equal(engine.canHandle("docx", "pdf"), true);
  assert.equal(engine.canHandle("docx", "html"), false);
  assert.equal(engine.canHandle("txt", "pdf"), false);
});

test("DOCX a PDF real, validación y cleanup de perfil", async (t) => {
  ENV.LIBREOFFICE_PATH = configured;
  const engine = new LibreOfficeEngine();
  if (!(await engine.isAvailable(true))) return t.skip("LibreOffice no está disponible");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "velyxora-lo-test-"));
  const input = path.join(dir, "input.docx");
  const output = path.join(dir, "result.pdf");
  await makeDocx(input);
  try {
    const result = await engine.convert(input, output, { targetFormat: "pdf" });
    assert.ok(result.size > 0);
    assert.equal(fs.readFileSync(output).subarray(0, 5).toString(), "%PDF-");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("AbortSignal cancela LibreOffice sin producir salida", async (t) => {
  ENV.LIBREOFFICE_PATH = configured;
  const engine = new LibreOfficeEngine();
  if (!(await engine.isAvailable(true))) return t.skip("LibreOffice no está disponible");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "velyxora-lo-cancel-"));
  const input = path.join(dir, "input.docx");
  const output = path.join(dir, "result.pdf");
  await makeDocx(input);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 5);
  try { await assert.rejects(engine.convert(input, output, { targetFormat: "pdf" }, undefined, controller.signal), /CONVERSION_CANCELLED/); assert.equal(fs.existsSync(output), false); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("timeout termina LibreOffice y limpia la salida parcial", async (t) => {
  ENV.LIBREOFFICE_PATH = configured;
  const engine = new LibreOfficeEngine();
  if (!(await engine.isAvailable(true))) return t.skip("LibreOffice no está disponible");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "velyxora-lo-timeout-"));
  const input = path.join(dir, "input.docx");
  const output = path.join(dir, "result.pdf");
  await makeDocx(input);
  const originalTimeout = ENV.LIBREOFFICE_TIMEOUT_MS;
  ENV.LIBREOFFICE_TIMEOUT_MS = 1;
  try { await assert.rejects(engine.convert(input, output, { targetFormat: "pdf" }), /LIBREOFFICE_TIMEOUT/); assert.equal(fs.existsSync(output), false); }
  finally { ENV.LIBREOFFICE_TIMEOUT_MS = originalTimeout; fs.rmSync(dir, { recursive: true, force: true }); }
});
