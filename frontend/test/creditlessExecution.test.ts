import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeReturnTo } from "../src/services/appRouting";
import { requiresServerAuthentication } from "../src/config/execution";
import { PUBLIC_TOOL_REGISTRY } from "../src/registry/tools";
import { SUPPORT_METHODS } from "../src/config/supportMethods";

test("solo las herramientas con ejecución de servidor exigen autenticación", () => {
  assert.equal(requiresServerAuthentication({ id: "png-to-jpg", requiresServer: false }), false);
  assert.equal(requiresServerAuthentication({ id: "json-formatter" }), false);
  assert.equal(requiresServerAuthentication({ id: "video-to-mp3", requiresServer: true }), true);
  assert.equal(requiresServerAuthentication({ id: "video-trimmer", requiresServer: true }), true);
  // Compatibilidad: video-to-mp3 se considera servidor aunque el flag falte.
  assert.equal(requiresServerAuthentication({ id: "video-to-mp3" }), true);
});

test("las herramientas CLIENT_SIDE no exigen autenticación para ejecutarse", () => {
  const clientTools = PUBLIC_TOOL_REGISTRY.filter((tool) => tool.processingMode === "CLIENT_SIDE");
  assert.ok(clientTools.length > 0, "debe existir al menos una herramienta CLIENT_SIDE");
  for (const tool of clientTools) {
    assert.equal(requiresServerAuthentication(tool), false, `${tool.id} no debería exigir autenticación`);
  }
});

test("sanitizeReturnTo acepta únicamente destinos internos válidos", () => {
  for (const safe of ["/tools/video-to-mp3", "/tools/png-to-jpg", "/category/video", "/media-downloader", "/support", "/"]) {
    assert.equal(sanitizeReturnTo(safe), safe, safe);
  }
  assert.equal(sanitizeReturnTo("/tools/video-to-mp3?x=1#frag"), "/tools/video-to-mp3");
});

test("sanitizeReturnTo bloquea redirecciones externas y maliciosas", () => {
  for (const unsafe of [
    "https://evil.com",
    "http://evil.com/tools/video-to-mp3",
    "//evil.com/tools/video-to-mp3",
    "/\\evil.com",
    "/\\/evil.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "/tools/not-a-real-tool",
    "/login",
    "/register",
    "/no-existe",
    "",
    "   ",
    undefined,
    null,
    "/tools/" + "a".repeat(400),
  ]) {
    assert.equal(sanitizeReturnTo(unsafe as string | null | undefined), null, String(unsafe));
  }
});

test("la configuración de apoyo voluntario no influye en los límites de ejecución", () => {
  for (const method of SUPPORT_METHODS) {
    for (const forbidden of ["credits", "priority", "maxUploadSize", "maxConcurrentJobs", "bypass", "limit"]) {
      assert.equal(forbidden in method, false, `${method.id} no debe exponer ${forbidden}`);
    }
  }
});
