import assert from "node:assert/strict";
import test from "node:test";
import { markdownToHtml } from "../src/services/dataConverterService";
import {
  getToolById,
  getToolRunnerKind,
  getToolsForGroup,
} from "../src/registry/tools";

const ids = (groupId: string) => getToolsForGroup(groupId).map((tool) => tool.id);

test("Converters agrupa conversores y no duplica Dev Tools", () => {
  const converters = ids("converters");
  for (const id of [
    "csv-to-json",
    "json-to-csv",
    "markdown-to-html",
    "color-converter",
    "unit-converter",
    "timestamp-converter",
    "aspect-ratio-calculator",
  ]) {
    assert.ok(converters.includes(id), `${id} debe estar en Converters`);
  }
  assert.equal(converters.includes("json-formatter"), false, "json-formatter no es un conversor de datos");
  assert.equal(ids("dev-tools").includes("csv-to-json"), false, "csv-to-json no debe estar en Dev Tools");
  assert.equal(ids("utilities").includes("unit-converter"), false, "unit-converter no debe duplicarse en Utilities");
});

test("Dev Tools y Utilities mantienen sus herramientas con runner válido", () => {
  const devTools = ids("dev-tools");
  for (const id of ["json-formatter", "jwt-decoder", "hash-generator", "uuid-generator", "diff-checker", "url-shortener"]) {
    assert.ok(devTools.includes(id), `${id} debe estar en Dev Tools`);
  }

  const utilities = ids("utilities");
  for (const id of ["password-generator", "word-counter", "case-converter", "qr-generator", "barcode-generator", "emoji-tool", "social-text-studio"]) {
    assert.ok(utilities.includes(id), `${id} debe estar en Utilities`);
  }

  const runners: Record<string, string> = {
    "csv-to-json": "data-code",
    "json-formatter": "text",
    "jwt-decoder": "text",
    "hash-generator": "text",
    "uuid-generator": "text",
    "unit-converter": "utilities",
    "timestamp-converter": "utilities",
    "aspect-ratio-calculator": "utilities",
    "qr-generator": "qr",
    "barcode-generator": "barcode",
    "password-generator": "text",
    "diff-checker": "data-code",
    "url-shortener": "creative",
  };
  for (const [id, kind] of Object.entries(runners)) {
    const tool = getToolById(id);
    assert.ok(tool, `${id} debe existir`);
    assert.equal(getToolRunnerKind(tool!), kind, `${id} debe usar el runner ${kind}`);
  }
});

test("estas herramientas son CLIENT_ONLY salvo el acortador de URL", () => {
  const groupIds = [...ids("converters"), ...ids("utilities"), ...ids("dev-tools")];
  for (const id of groupIds) {
    const tool = getToolById(id);
    assert.ok(tool, `${id} debe existir`);
    if (id === "url-shortener") {
      assert.equal(tool!.processingMode, "SERVER_SIDE");
      assert.equal(Boolean(tool!.requiresServer), true);
      continue;
    }
    assert.equal(tool!.processingMode, "CLIENT_SIDE", `${id} debe ser CLIENT_SIDE`);
    assert.equal(Boolean(tool!.requiresServer), false, `${id} no debe requerir backend`);
  }
});

test("Markdown → HTML renderiza blockquotes sin romper el escape", () => {
  const html = markdownToHtml("> cita segura");
  assert.match(html, /<blockquote/);
  assert.match(html, /cita segura/);
  assert.doesNotMatch(html, /<script>/);
});

test("el decodificador JWT no se describe como verificación de firma", () => {
  const description = getToolById("jwt-decoder")!.description;
  assert.match(description, /No verifica la firma/i);
});
