import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORT_METHODS,
  SUPPORT_REGIONS,
  getSupportMethods,
  isMethodAvailable,
  isSafePublicId,
  isSafeQrAsset,
  isSafeSupportUrl,
  type SupportMethodConfig,
} from "../src/config/supportMethods";
import { routeFromPath } from "../src/services/appRouting";

test("define exactamente dos regiones de apoyo", () => {
  assert.deepEqual(SUPPORT_REGIONS.map((region) => region.id), ["peru", "international"]);
});

test("cada proveedor usa el modo de activación correcto", () => {
  const byId = Object.fromEntries(SUPPORT_METHODS.map((method) => [method.id, method]));
  assert.equal(byId.yape.mode, "public-identifier");
  assert.equal(byId.plin.mode, "public-identifier");
  assert.equal(byId.paypal.mode, "external-link");
  assert.equal(byId.kofi.mode, "external-link");
  assert.equal(byId["github-sponsors"].mode, "external-link");
});

test("estado del registro: cuatro proveedores activos y GitHub Sponsors próximamente", () => {
  const byId = Object.fromEntries(SUPPORT_METHODS.map((method) => [method.id, method]));

  for (const id of ["yape", "plin", "paypal", "kofi"]) {
    assert.equal(byId[id].state, "available", `${id} debe estar disponible`);
    assert.equal(isMethodAvailable(byId[id]), true, `${id} debe ser accionable`);
  }

  assert.equal(byId.paypal.url, "https://paypal.me/WangLing79");
  assert.equal(byId.kofi.url, "https://ko-fi.com/wanglingt");
  assert.equal(byId.yape.publicId, "968555200");
  assert.equal(byId.plin.publicId, "968555200");

  assert.equal(byId["github-sponsors"].state, "coming-soon");
  assert.equal(isMethodAvailable(byId["github-sponsors"]), false);

  assert.equal(SUPPORT_METHODS.filter(isMethodAvailable).length, 4);
  assert.equal(SUPPORT_METHODS.filter((method) => !isMethodAvailable(method)).length, 1);
});

test("Yape y Plin no inventan URLs, deep links ni QR", () => {
  for (const method of getSupportMethods("peru")) {
    assert.equal(method.url, undefined, `${method.id} no debe tener URL inventada`);
    assert.equal(method.qrImageUrl, undefined, `${method.id} no debe tener QR inventado`);
    assert.equal(method.publicId, "968555200", `${method.id} debe usar solo el número público configurado`);
  }
});

test("GitHub Sponsors permanece como próximamente hasta completar su incorporación", () => {
  const sponsors = SUPPORT_METHODS.find((method) => method.id === "github-sponsors");
  assert.ok(sponsors, "github-sponsors debe existir");
  assert.equal(sponsors.state, "coming-soon");
  assert.equal(sponsors.url, undefined);
  assert.equal(isMethodAvailable(sponsors), false);
});

test("isSafeSupportUrl acepta HTTPS de proveedores oficiales, incluido PayPal.Me", () => {
  for (const safe of [
    "https://ko-fi.com/wanglingt",
    "https://www.paypal.com/donate",
    "https://paypal.me/velyxora",
    "https://github.com/sponsors/velyxora",
  ]) {
    assert.equal(isSafeSupportUrl(safe), true, safe);
  }

  for (const unsafe of [
    "http://ko-fi.com/wanglingt",
    "javascript:alert(1)",
    "https://evil.com/donate",
    "https://paypal.com.evil.com/donate",
    "https://paypal.me.evil.com/donate",
    "https://user:pass@github.com/sponsors/x",
    "",
    undefined,
  ]) {
    assert.equal(isSafeSupportUrl(unsafe), false, String(unsafe));
  }
});

test("isSafePublicId acepta números plausibles y rechaza marcadores y texto", () => {
  for (const safe of ["999888777", "51999888777", "+51 999 888 777", "999-888-777"]) {
    assert.equal(isSafePublicId(safe), true, safe);
  }

  for (const unsafe of [
    "YOUR_PUBLIC_YAPE_NUMBER",
    "YOUR_PUBLIC_PLIN_NUMBER",
    "abc123456",
    "12345",
    "+1234567890123456",
    "999 888 777; DROP TABLE",
    "",
    "   ",
    undefined,
  ]) {
    assert.equal(isSafePublicId(unsafe), false, String(unsafe));
  }
});

test("isSafeQrAsset se mantiene para configuración futura", () => {
  assert.equal(isSafeQrAsset("/support/yape-qr.png"), true);
  assert.equal(isSafeQrAsset("https://cdn.velyxora.com/yape-qr.png"), true);
  assert.equal(isSafeQrAsset("//evil.com/qr.png"), false);
  assert.equal(isSafeQrAsset("javascript:alert(1)"), false);
  assert.equal(isSafeQrAsset(undefined), false);
});

test("un método externo solo es accionable con estado disponible y URL oficial segura", () => {
  const base: SupportMethodConfig = {
    id: "x",
    name: "X",
    region: "international",
    description: "",
    icon: "Coffee",
    mode: "external-link",
    state: "available",
  };
  assert.equal(isMethodAvailable({ ...base, url: "https://ko-fi.com/wanglingt" }), true);
  assert.equal(isMethodAvailable({ ...base, url: "https://paypal.me/velyxora" }), true);
  assert.equal(isMethodAvailable({ ...base, url: "https://evil.com" }), false);
  assert.equal(isMethodAvailable({ ...base, url: undefined }), false);
  assert.equal(isMethodAvailable({ ...base, state: "coming-soon", url: "https://ko-fi.com/wanglingt" }), false);
});

test("Yape/Plin solo se activan con estado disponible y número válido, sin QR", () => {
  const base: SupportMethodConfig = {
    id: "yape",
    name: "Yape",
    region: "peru",
    description: "",
    icon: "Smartphone",
    mode: "public-identifier",
    state: "coming-soon",
  };

  assert.equal(isMethodAvailable(base), false, "sin número no es accionable");
  assert.equal(isMethodAvailable({ ...base, publicId: "999888777" }), false, "un número sin estado disponible no basta");
  assert.equal(
    isMethodAvailable({ ...base, state: "available", publicId: "999888777", qrImageUrl: undefined }),
    true,
    "estado disponible + número válido activa sin necesidad de QR",
  );
  assert.equal(
    isMethodAvailable({ ...base, state: "available", publicId: "YOUR_PUBLIC_YAPE_NUMBER" }),
    false,
    "un marcador no activa el método",
  );
  assert.equal(isMethodAvailable({ ...base, state: "available" }), false, "sin número no activa");
});

test("un método QR no se activa sin estado disponible y asset válido", () => {
  const base: SupportMethodConfig = {
    id: "future-qr",
    name: "Future QR",
    region: "peru",
    description: "",
    icon: "Smartphone",
    mode: "qr-display",
    state: "coming-soon",
  };
  assert.equal(isMethodAvailable(base), false);
  assert.equal(isMethodAvailable({ ...base, qrImageUrl: "/support/x-qr.png" }), false);
  assert.equal(isMethodAvailable({ ...base, state: "available", qrImageUrl: "javascript:alert(1)" }), false);
  assert.equal(isMethodAvailable({ ...base, state: "available", qrImageUrl: "/support/x-qr.png" }), true);
});

test("la ruta /support sigue resolviendo la vista de apoyo", () => {
  assert.deepEqual(routeFromPath("/support"), { view: "support" });
});
