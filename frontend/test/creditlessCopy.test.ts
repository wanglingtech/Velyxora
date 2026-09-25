import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACCOUNT_SERVICE_SUMMARY } from "../src/config/freeService";
import { routeFromPath } from "../src/services/appRouting";

const readSrc = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const header = readSrc("../src/components/layout/Header.tsx");
const accountViews = readSrc("../src/components/views/AccountViews.tsx");
const legal = readSrc("../src/components/views/LegalView.tsx");
const footer = readSrc("../src/components/layout/Footer.tsx");
const support = readSrc("../src/components/views/SupportView.tsx");

const accountViewOnly = accountViews.slice(
  accountViews.indexOf("export function AccountView"),
  accountViews.indexOf("export function AdminView"),
);
const adminViewOnly = accountViews.slice(
  accountViews.indexOf("export function AdminView"),
  accountViews.indexOf("function StatusBadge"),
);

test("el Header no expone créditos ni CTA de compra/planes", () => {
  for (const forbidden of ["Obtener créditos", "créditos", "CreditCard", "Coins", "ADMIN_TEST", "creditCapacity"]) {
    assert.equal(header.includes(forbidden), false, `Header no debe incluir "${forbidden}"`);
  }
  // Preserva acceso de cuenta, navegación y estado del servicio.
  assert.ok(header.includes("backendHealth"), "Header debe conservar el estado del backend");
  assert.ok(header.includes("Administración"), "Header debe conservar el acceso administrativo");
  assert.ok(header.includes("Mi cuenta"), "Header debe conservar el acceso de cuenta");
});

test("AccountView no expone plan, créditos, reset, ledger ni compras legacy", () => {
  for (const forbidden of [
    "Créditos disponibles",
    "Próximo reset",
    "Ledger reciente",
    "Pagos Yape",
    "PLUS",
    "monthlyCredits",
    "consumedCredits",
    "creditsCost",
    "paymentConfig",
    "PaymentCard",
    "apiClient.payments",
    "Yape",
  ]) {
    assert.equal(accountViewOnly.includes(forbidden), false, `AccountView no debe incluir "${forbidden}"`);
  }
});

test("AccountView conserva identidad, uso, historial, reclamos y sugerencias", () => {
  for (const required of [
    "Mi cuenta",
    "Activa",
    "Jobs recientes",
    "Historial sincronizado",
    "Mis reclamos",
    "Mis sugerencias",
    "ACCOUNT_SERVICE_SUMMARY",
  ]) {
    assert.ok(accountViewOnly.includes(required), `AccountView debe conservar "${required}"`);
  }
});

test("el resumen de servicio gratuito evita conceptos monetarios y de créditos", () => {
  const labels = ACCOUNT_SERVICE_SUMMARY.map((item) => item.label).join(" ").toLowerCase();
  const values = ACCOUNT_SERVICE_SUMMARY.map((item) => item.value).join(" ").toLowerCase();
  for (const forbidden of ["crédito", "credito", "plan", "pago", "yape", "saldo", "prioridad"]) {
    assert.equal(labels.includes(forbidden), false, `resumen no debe incluir "${forbidden}"`);
    assert.equal(values.includes(forbidden), false, `resumen no debe incluir "${forbidden}"`);
  }
  assert.ok(values.includes("gratuito"));
  assert.ok(values.includes("inicio de sesión"));
});

test("LegalView ya no describe créditos, PaymentOrder ni compras manuales", () => {
  for (const forbidden of ["PaymentOrder", "ledger", "monthlyCredits", "créditos acreditados", "créditos mensuales", "PLUS"]) {
    assert.equal(legal.includes(forbidden), false, `LegalView no debe incluir "${forbidden}"`);
  }
});

test("LegalView describe el modelo gratuito, el servidor autenticado y el apoyo voluntario", () => {
  assert.ok(legal.toLowerCase().includes("gratuito"), "debe indicar que es gratuito");
  assert.ok(legal.includes("Apoyo voluntario"), "debe describir el apoyo voluntario");
  assert.ok(legal.includes("iniciar sesión"), "debe indicar que el servidor requiere inicio de sesión");
  assert.ok(legal.includes("no verifica"), "debe aclarar que Yape/Plin no se verifican");
  assert.ok(legal.includes("PayPal") && legal.includes("Ko-fi"), "debe mencionar los proveedores externos");
});

test("no se introduce una afirmación falsa de código abierto", () => {
  for (const [name, source] of [["LegalView", legal], ["Footer", footer]] as const) {
    assert.equal(source.toLowerCase().includes("open source"), false, `${name} no debe afirmar open source`);
    assert.equal(source.toLowerCase().includes("código abierto"), false, `${name} no debe afirmar código abierto`);
  }
});

test("el panel admin ya no expone créditos, planes, reset ni pagos legacy", () => {
  for (const forbidden of [
    "Créditos netos",
    "Pagos pendientes",
    "adminPayments",
    "reviewPayment",
    "pendingPayments",
    "Próximo reset",
    "Ledger",
    "Sistema operativo",
    "PENDING_PAYMENT",
    "ESPERANDO PAGO",
  ]) {
    assert.equal(adminViewOnly.includes(forbidden), false, `AdminView no debe incluir "${forbidden}"`);
  }
  assert.equal(accountViews.includes("paymentWhatsappService"), false, "AccountViews no debe importar el servicio legacy de pagos");
});

test("el panel admin conserva moderación, reclamos, sugerencias y enlaces", () => {
  for (const required of [
    "Gestión de usuarios",
    "Moderación de usuarios",
    "Reclamos",
    "Sugerencias nuevas",
    "Reportes de enlaces cortos",
  ]) {
    assert.ok(adminViewOnly.includes(required), `AdminView debe conservar "${required}"`);
  }
});

test("el apoyo voluntario permanece separado y accesible", () => {
  assert.deepEqual(routeFromPath("/support"), { view: "support" });
  assert.ok(footer.includes("onNavigate('support')"), "el pie de página debe enlazar el apoyo");
  assert.equal(accountViewOnly.includes("Yape"), false, "la cuenta no debe mezclar el apoyo con compras legacy");
});

test("SupportView no conserva terminología de créditos y mantiene su funcionamiento", () => {
  assert.equal(/cr[eé]dito/i.test(support), false, "SupportView no debe mencionar créditos");
  for (const required of [
    "getSupportMethods",
    "isMethodAvailable",
    "SUPPORT_REGIONS",
    "onBack",
  ]) {
    assert.ok(support.includes(required), `SupportView debe conservar "${required}"`);
  }
});
