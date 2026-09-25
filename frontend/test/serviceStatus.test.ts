import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SERVICE_STATE_LABELS,
  deriveServiceOperationalState,
  isServiceOperationalState,
  resolveServiceOperationalState,
  type ServiceOperationalState,
} from "../src/config/serviceStatus";
import type { BackendHealth } from "../src/services/apiClient";

const healthy = (overrides: Partial<BackendHealth["services"]> = {}, status: BackendHealth["status"] = "ok"): BackendHealth => ({
  status,
  version: "1.0.0",
  uptimeSeconds: 1,
  services: { ffmpeg: true, ffprobe: true, libreOffice: true, storage: true, ytDlp: true, database: true, ...overrides },
});

const header = readFileSync(fileURLToPath(new URL("../src/components/layout/Header.tsx", import.meta.url)), "utf8");
const accountViews = readFileSync(fileURLToPath(new URL("../src/components/views/AccountViews.tsx", import.meta.url)), "utf8");

test("los estados de servicio se traducen exactamente al español de producto", () => {
  assert.deepEqual(SERVICE_STATE_LABELS, {
    OPERATIONAL: "Operativo",
    LIMITED: "Limitado",
    MAINTENANCE: "Mantenimiento",
    UNAVAILABLE: "No disponible",
  });
  for (const state of ["OPERATIONAL", "LIMITED", "MAINTENANCE", "UNAVAILABLE"]) {
    assert.equal(isServiceOperationalState(state), true);
  }
  assert.equal(isServiceOperationalState("ok"), false);
  assert.equal(isServiceOperationalState(undefined), false);
});

test("la señal pública deriva del estado real sin inventar mantenimiento", () => {
  assert.equal(deriveServiceOperationalState(null), "UNAVAILABLE");
  assert.equal(deriveServiceOperationalState(healthy({}, "error")), "UNAVAILABLE");
  assert.equal(deriveServiceOperationalState(healthy({ database: false })), "UNAVAILABLE");
  assert.equal(deriveServiceOperationalState(healthy({}, "degraded")), "LIMITED");
  assert.equal(deriveServiceOperationalState(healthy({ ffmpeg: false })), "LIMITED");
  assert.equal(deriveServiceOperationalState(healthy({ ytDlp: false })), "LIMITED");
  assert.equal(deriveServiceOperationalState(healthy()), "OPERATIONAL");
  // MAINTENANCE nunca se deriva de la salud de componentes.
  assert.notEqual(deriveServiceOperationalState(healthy({ ffmpeg: false })), "MAINTENANCE");
});

test("un estado explícito de administración prevalece sobre la salud", () => {
  const admin: ServiceOperationalState = "MAINTENANCE";
  assert.equal(resolveServiceOperationalState(admin, healthy()), "MAINTENANCE");
  assert.equal(resolveServiceOperationalState(null, healthy()), "OPERATIONAL");
  assert.equal(resolveServiceOperationalState(undefined, null), "UNAVAILABLE");
});

test("el Header comunica estado de producto y no detalles de infraestructura", () => {
  assert.ok(header.includes("Estado del servicio"), "el Header debe comunicar el estado del producto");
  for (const forbidden of ["FFmpeg", "Railway", "PostgreSQL", "yt-dlp", "LibreOffice", "Backend:", "ffmpeg"]) {
    assert.equal(header.includes(forbidden), false, `el Header no debe exponer "${forbidden}"`);
  }
});

test("el Header consume el estado público persistido y conserva el fallback técnico", () => {
  assert.ok(header.includes("apiClient.status"), "el Header debe consultar el estado público");
  assert.ok(header.includes("isServiceOperationalState(status?.state)"), "debe validar el estado público");
  assert.ok(header.includes("checkHealth"), "debe conservar el respaldo de salud técnica");
  assert.ok(header.includes("resolveServiceOperationalState(productStatus?.state ?? null, backendHealth)"), "el estado persistido debe tener prioridad");
});

test("AdminView expone el control de estado del servicio sin filtrar datos administrativos al público", () => {
  for (const required of [
    "Estado del servicio",
    "adminServiceStatus",
    "updateServiceStatus",
    "Guardar estado",
    "Mensaje público (opcional)",
  ]) {
    assert.ok(accountViews.includes(required), `AdminView debe incluir "${required}"`);
  }
  for (const forbidden of ["updatedById", "singleton"]) {
    assert.equal(accountViews.includes(forbidden), false, `AdminView no debe exponer "${forbidden}"`);
  }
});
