import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  resolveCanvasConversionTarget,
  resolveCanvasOutputFormat,
  validateOutputDimensions,
} from "../src/services/conversionEngine";
import {
  PUBLIC_TOOL_REGISTRY,
  getToolRunnerKind,
  getToolsForGroup,
} from "../src/registry/tools";

test("resolveCanvasOutputFormat solo produce formatos que el navegador puede generar", () => {
  assert.deepEqual(resolveCanvasOutputFormat("image/jpeg"), { mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(resolveCanvasOutputFormat("image/jpg"), { mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(resolveCanvasOutputFormat("image/webp"), { mime: "image/webp", extension: "webp" });
  assert.deepEqual(resolveCanvasOutputFormat("image/png"), { mime: "image/png", extension: "png" });

  // Unsupported inputs must fall back to PNG instead of claiming success.
  for (const unsupported of ["image/gif", "image/svg+xml", "image/bmp", "", undefined]) {
    assert.deepEqual(resolveCanvasOutputFormat(unsupported), { mime: "image/png", extension: "png" }, String(unsupported));
  }
});

test("resolveCanvasConversionTarget respeta el primer formato realmente generable", () => {
  assert.deepEqual(resolveCanvasConversionTarget(["image/png"]), { mime: "image/png", extension: "png" });
  assert.deepEqual(resolveCanvasConversionTarget(["image/jpeg", "image/png"]), { mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(resolveCanvasConversionTarget(["image/gif", "image/webp"]), { mime: "image/webp", extension: "webp" });

  // Nothing encodable: the runner must fail explicitly, not mislabel a PNG.
  assert.equal(resolveCanvasConversionTarget(["image/gif"]), null);
  assert.equal(resolveCanvasConversionTarget([]), null);
});

test("cada conversión de imagen registrada apunta a un formato que el navegador puede generar", () => {
  const conversions = PUBLIC_TOOL_REGISTRY.filter(
    (tool) => tool.category === "image" && tool.subcategory === "Conversión",
  );
  assert.ok(conversions.length >= 12, "el catálogo debe cubrir la matriz de conversiones");

  for (const tool of conversions) {
    const target = resolveCanvasConversionTarget(tool.outputTypes);
    assert.ok(target, `${tool.id} declara un formato que el motor no puede generar`);
    assert.ok(
      ["png", "jpg", "webp"].includes(target.extension),
      `${tool.id} debe producir una extensión real (${target.extension})`,
    );
  }
});

test("validateOutputDimensions rechaza dimensiones inválidas o inseguras", () => {
  assert.deepEqual(validateOutputDimensions(100, 200), { width: 100, height: 200 });
  assert.deepEqual(validateOutputDimensions(100.4, 200.6), { width: 100, height: 201 });
  assert.deepEqual(validateOutputDimensions(6000, 6000), { width: 6000, height: 6000 });

  for (const [w, h] of [[0, 100], [100, 0], [-5, 100], [NaN, 100]]) {
    assert.throws(() => validateOutputDimensions(w, h), /mayores a 0/i);
  }
  assert.throws(() => validateOutputDimensions(MAX_IMAGE_DIMENSION + 1, 10), /no pueden superar/i);
  assert.throws(() => validateOutputDimensions(7000, 6000), /demasiado grande/i);
  assert.ok(MAX_IMAGE_PIXELS === 40_000_000 || MAX_IMAGE_PIXELS > 0);
});

test("todas las herramientas de Imagen son CLIENT_SIDE y sin backend", () => {
  const groupIds = new Set(getToolsForGroup("images").map((tool) => tool.id));
  const imageTools = PUBLIC_TOOL_REGISTRY.filter((tool) => tool.category === "image");
  assert.ok(imageTools.length > 0);

  for (const tool of imageTools) {
    assert.equal(tool.processingMode, "CLIENT_SIDE", `${tool.id} debe ser CLIENT_SIDE`);
    assert.equal(Boolean(tool.requiresServer), false, `${tool.id} no debe requerir backend`);
    assert.equal(groupIds.has(tool.id), true, `${tool.id} debe pertenecer al grupo Images`);
    assert.ok(getToolRunnerKind(tool), `${tool.id} debe tener runner`);
  }
});
