import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_SERVICE_LABELS,
  countToolsInMaintenance,
  getMissingServices,
  isToolInMaintenance,
  maintenanceTooltip,
  requiredServicesOf,
  type RequiredService,
} from "../src/services/toolAvailability";
import { PUBLIC_TOOL_REGISTRY } from "../src/registry/tools";

const source = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const toolCard = source("../src/components/common/ToolCard.tsx");
const categoryView = source("../src/components/views/CategoryView.tsx");
const homeView = source("../src/components/views/HomeView.tsx");

const serviceKeys: RequiredService[] = ["ffmpeg", "libreOffice", "ytDlp"];

test("FASE 1.2: la etiqueta de servicio cubre todos los motores declarables", () => {
  assert.deepEqual(Object.keys(REQUIRED_SERVICE_LABELS).sort(), [...serviceKeys].sort());
  for (const key of serviceKeys) {
    assert.equal(typeof REQUIRED_SERVICE_LABELS[key], "string");
    assert.ok(REQUIRED_SERVICE_LABELS[key].length > 0);
  }
});

test("FASE 1.2: getMissingServices solo devuelve dependencias caídas", () => {
  const tool = { requiredServices: ["ffmpeg", "ytDlp"] as RequiredService[] };
  const down = (service: RequiredService) => service !== "ffmpeg";

  assert.deepEqual(getMissingServices(tool, () => true), []);
  assert.deepEqual(getMissingServices(tool, down), ["ffmpeg"]);
  assert.deepEqual(getMissingServices(tool, () => false), ["ffmpeg", "ytDlp"]);
  assert.deepEqual(getMissingServices({ requiredServices: undefined }, () => false), []);
  assert.deepEqual(requiredServicesOf({ requiredServices: [] }), []);
});

test("FASE 1.2: una tool está en mantenimiento si falla cualquier servicio requerido", () => {
  const ffmpegOnly = { requiredServices: ["ffmpeg"] as RequiredService[] };
  const documentTool = { requiredServices: ["libreOffice"] as RequiredService[] };
  const localTool = { requiredServices: undefined };

  assert.equal(isToolInMaintenance(ffmpegOnly, () => true), false);
  assert.equal(isToolInMaintenance(ffmpegOnly, (s) => s !== "ffmpeg"), true);
  assert.equal(isToolInMaintenance(documentTool, (s) => s !== "libreOffice"), true);
  assert.equal(isToolInMaintenance(localTool, () => false), false);

  assert.equal(
    countToolsInMaintenance([ffmpegOnly, documentTool, localTool], (s) => s === "ffmpeg"),
    1,
  );
});

test("FASE 1.2: el tooltip usa lenguaje de producto, sin jerga de infraestructura", () => {
  const message = maintenanceTooltip(["ffmpeg", "ytDlp"]);
  assert.ok(message.includes("mantenimiento"));
  assert.ok(message.includes("herramientas locales"));
  for (const forbidden of ["ffmpeg", "libreOffice", "yt-dlp", "Railway", "backend"]) {
    assert.equal(message.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
  assert.equal(maintenanceTooltip([]), "");
});

test("FASE 1.2: los requiredServices del registro tienen etiqueta de producto", () => {
  const declared = new Set<string>();
  for (const tool of PUBLIC_TOOL_REGISTRY) {
    for (const service of tool.requiredServices ?? []) declared.add(service);
  }
  assert.ok(declared.size > 0, "el registro público debe declarar dependencias de servicio");
  for (const service of declared) {
    assert.ok(service in REQUIRED_SERVICE_LABELS, `falta etiqueta para ${service}`);
  }
});

test("FASE 1.2.1: ToolCard muestrea mantenimiento, desactiva la tarjeta y explica el motivo", () => {
  assert.ok(toolCard.includes("getMissingServices"), "debe derivar los servicios caídos");
  assert.ok(toolCard.includes("Mantenimiento"), "debe mostrar el badge visible");
  assert.ok(toolCard.includes("maintenanceTooltip"), "el badge debe llevar tooltip explicativo");
  assert.ok(toolCard.includes("disabled={isMaintenance}"), "el botón de favoritos debe desactivarse");
  assert.ok(toolCard.includes("aria-disabled"), "la tarjeta debe anunciar su estado accesible");
  assert.ok(
    toolCard.includes("onClick={isMaintenance ? undefined : () => onSelect(tool)}"),
    "la tarjeta no debe navegar en mantenimiento",
  );
  // Product copy: never leak infrastructure names into the card.
  for (const forbidden of ["ffmpeg", "libreOffice", "yt-dlp", "Railway"]) {
    assert.equal(toolCard.includes(forbidden), false, `la tarjeta no debe mencionar "${forbidden}"`);
  }
});

test("FASE 1.2.2: CategoryView filtra y permite revelar herramientas en mantenimiento", () => {
  assert.ok(categoryView.includes("isToolInMaintenance"), "debe filtrar por disponibilidad");
  assert.ok(categoryView.includes("Mostrar en mantenimiento"), "debe existir el control para revelarlas");
  assert.ok(categoryView.includes("en mantenimiento"), "debe resumir el conteo en la cabecera");
  assert.ok(categoryView.includes("showMaintenance ||"), "el filtro debe respetar el toggle");
  assert.ok(categoryView.includes("countToolsInMaintenance"), "debe reutilizar el helper compartido");
});

test("FASE 1.2.3: HomeView resume el estado de las herramientas populares", () => {
  assert.ok(homeView.includes("countToolsInMaintenance"), "debe contar populares en mantenimiento");
  assert.ok(homeView.includes("popularMaintenanceCount"), "debe exponer el conteo en la UI");
  assert.ok(homeView.includes("en mantenimiento"), "debe mostrar el aviso al usuario");
  for (const forbidden of ["ffmpeg", "libreOffice", "yt-dlp", "Railway"]) {
    assert.equal(homeView.includes(forbidden), false, `HomeView no debe mencionar "${forbidden}"`);
  }
});
