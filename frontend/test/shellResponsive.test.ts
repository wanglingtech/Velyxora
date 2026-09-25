import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readSrc = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const header = readSrc("../src/components/layout/Header.tsx");
const footer = readSrc("../src/components/layout/Footer.tsx");
const app = readSrc("../src/App.tsx");
const floating = readSrc("../src/components/common/FloatingSupportButton.tsx");
const toasts = readSrc("../src/components/common/ToastContainer.tsx");
const indexHtml = readSrc("../index.html");

test("el Header conserva identidad, menú, cuenta y estado de servicio", () => {
  for (const required of [
    'aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}',
    "VelyxoraLogo",
    'aria-label="Menú de cuenta"',
    "Administración",
    "Estado del servicio",
  ]) {
    assert.ok(header.includes(required), `el Header debe conservar "${required}"`);
  }
});

test("el Header adapta densidad por breakpoint sin desbordar", () => {
  for (const required of ["sm:hidden", "hidden sm:flex", "hidden lg:inline-flex", "hidden md:flex", "min-w-0"]) {
    assert.ok(header.includes(required), `el Header debe incluir "${required}"`);
  }
  assert.doesNotMatch(header, /\bw-screen\b/, "el Header no debe usar el ancho completo del viewport");
  assert.equal(header.includes("overflow-x"), false, "el Header no debe ocultar el desbordamiento");
});

test("el estado de servicio no se comunica solo por color", () => {
  assert.ok(header.includes('role="status"'), "el estado debe ser un role=status");
  assert.ok(header.includes("SERVICE_STATE_LABELS[state]"), "el estado debe mostrar la etiqueta textual");
  assert.ok(header.includes("SERVICE_STATE_DOTS[state]"), "el estado debe conservar el punto de color");
  assert.doesNotMatch(header, /truncate[^"]*SERVICE_STATE_LABELS/, "la etiqueta de estado no debe truncarse");
});

test("el Footer reorganiza su contenido con grid y wrap, sin anchos que desborden", () => {
  for (const required of [
    "flex-wrap",
    "min-w-0",
    "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]",
    'aria-label="Enlaces del sitio"',
    'aria-label="Redes sociales y comunidad"',
    "onNavigate('support')",
  ]) {
    assert.ok(footer.includes(required), `el Footer debe incluir "${required}"`);
  }
  assert.doesNotMatch(footer, /min-w-\[\d{3,}px\]|w-\[\d{3,}px\]/, "el Footer no debe fijar anchos grandes en píxeles");
  assert.equal(footer.includes("overflow-x"), false, "el Footer no debe ocultar el desbordamiento");
});

test("el botón flotante de apoyo es accesible y respeta las safe areas", () => {
  for (const required of [
    "<button",
    'aria-label="Apoyar VELYXORA"',
    "safe-area-inset-bottom",
    "safe-area-inset-right",
    "z-40",
  ]) {
    assert.ok(floating.includes(required), `el botón flotante debe incluir "${required}"`);
  }
  assert.equal(floating.includes("animate-pulse"), false, "el botón no debe pulsar");
});

test("los avisos emergentes no colisionan con el botón flotante", () => {
  assert.ok(toasts.includes("top-24"), "los avisos deben anclarse arriba");
  assert.doesNotMatch(toasts, /bottom-4/, "los avisos no deben compartir la esquina inferior del botón flotante");
});

test("el shell integra el aviso y el botón de apoyo reutilizando el flujo existente", () => {
  for (const required of [
    "SupportPromptModal",
    "FloatingSupportButton",
    "shouldShowSupportPrompt",
    "markSupportPromptShown",
    "activeView !== 'support'",
  ]) {
    assert.ok(app.includes(required), `App debe incluir "${required}"`);
  }
  assert.ok(app.includes("handleNavigate('support')"), "el apoyo debe navegar a la vista existente");
});

test("el cuerpo no oculta el desbordamiento horizontal a nivel de página", () => {
  assert.equal(indexHtml.includes("overflow-x-hidden"), false, "index.html no debe ocultar el desbordamiento");
});