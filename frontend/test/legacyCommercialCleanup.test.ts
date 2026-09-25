import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SUPPORT_METHODS, getSupportMethods, isMethodAvailable } from "../src/config/supportMethods";

const readSrc = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

test("no quedan eventos muertos de créditos en el frontend", () => {
  for (const relative of [
    "../src/components/tools/ToolRunner.tsx",
    "../src/components/tools/MediaDownloaderView.tsx",
  ]) {
    assert.equal(readSrc(relative).includes("credits-changed"), false, `${relative} no debe emitir velyxora:credits-changed`);
  }
});

test("no quedan referencias runtime a creditsCost en el frontend", () => {
  for (const relative of [
    "../src/types.ts",
    "../src/services/historyService.ts",
    "../src/registry/tools.ts",
    "../src/components/tools/subtools/StickerMakerTool.tsx",
  ]) {
    assert.equal(readSrc(relative).includes("creditsCost"), false, `${relative} no debe exponer creditsCost`);
  }
});

test("el cliente API no expone namespaces de créditos ni pagos", () => {
  const apiClient = readSrc("../src/services/apiClient.ts");
  for (const forbidden of ["/credits", "/payments", "credits:", "payments:"]) {
    assert.equal(apiClient.includes(forbidden), false, `apiClient no debe incluir ${forbidden}`);
  }
});

test("el apoyo voluntario permanece intacto y separado del modelo comercial", () => {
  for (const id of ["yape", "plin", "paypal", "kofi", "github-sponsors"]) {
    assert.ok(SUPPORT_METHODS.some((method) => method.id === id), `debe conservarse el método ${id}`);
  }
  assert.equal(typeof getSupportMethods, "function");
  assert.equal(typeof isMethodAvailable, "function");
  assert.equal(SUPPORT_METHODS.find((method) => method.id === "github-sponsors")?.state, "coming-soon");
});
