import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { ENV } from "../src/config/env";
import { LibreOfficeEngine } from "../src/engines/LibreOfficeEngine";
import request from "supertest";
import { backendApp } from "../src/app";
import { storageService } from "../src/services/storageService";

const configured = process.env.LIBREOFFICE_PATH || (process.platform === "win32" ? "C:\\Program Files\\LibreOffice\\program\\soffice.exe" : "soffice");

async function makeDocx(target: string) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>VELYXORA LibreOffice integration</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);
  fs.writeFileSync(target, await zip.generateAsync({ type: "nodebuffer" }));
}

async function makeXlsx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="VELYXORA" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>VELYXORA XLSX</t></is></c></row></sheetData></worksheet>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function makePptx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  zip.file('ppt/presentation.xml', `<?xml version="1.0"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`);
  zip.file('ppt/slides/slide1.xml', `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function makeDocxBuffer(): Promise<Buffer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velyxora-docx-buffer-'));
  const file = path.join(dir, 'input.docx');
  try { await makeDocx(file); return fs.readFileSync(file); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
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

test("API E2E DOCX/XLSX/PPTX convierte, completa y descarga PDFs reales", async (t) => {
  ENV.LIBREOFFICE_PATH = configured;
  if (!(await new LibreOfficeEngine().isAvailable(true))) return t.skip('LibreOffice no está disponible');
  const fixtures = [
    { filename: 'document.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', toolId: 'word-to-pdf', body: await makeDocxBuffer() },
    { filename: 'sheet.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', toolId: 'xlsx-to-pdf', body: await makeXlsx() },
    { filename: 'slides.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', toolId: 'pptx-to-pdf', body: await makePptx() },
  ];
  for (const fixture of fixtures) {
    const upload = await request(backendApp).post('/api/uploads').attach('file', fixture.body, { filename: fixture.filename, contentType: fixture.mime });
    assert.equal(upload.status, 201);
    const started = await request(backendApp).post('/api/conversions').send({ fileId: upload.body.data.fileId, toolId: fixture.toolId, targetFormat: 'pdf' });
    assert.equal(started.status, 202);
    let job = started.body.data;
    for (let attempt = 0; attempt < 200 && !['COMPLETED','FAILED','CANCELLED'].includes(job.status); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      job = (await request(backendApp).get(`/api/jobs/${job.id}`)).body.data;
    }
    assert.equal(job.status, 'COMPLETED', `${fixture.filename}: ${job.error || 'sin output'}`);
    const download = await request(backendApp).get(`/api/download/${job.output.fileId}`);
    assert.equal(download.status, 200);
    assert.match(download.headers['content-type'], /application\/pdf/);
    assert.equal(Buffer.from(download.body).subarray(0, 5).toString(), '%PDF-');
    storageService.deleteFile(job.output.fileId);
  }
});
