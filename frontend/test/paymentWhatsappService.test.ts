import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaymentWhatsAppMessage,
  buildPaymentWhatsAppUrl,
  isPaymentWhatsAppStatus,
} from "../src/services/paymentWhatsappService";

const base = {
  phone: "51968555200",
  email: "persona@example.com",
  order: {
    id: "order-owned-123",
    status: "PENDING_REVIEW",
    amountMinor: 1500,
    currency: "PEN",
    reference: "968555200",
    plan: { code: "PLUS" },
  },
};

test("construye y codifica el mensaje con datos reales de la orden", () => {
  const url = buildPaymentWhatsAppUrl(base);
  assert.match(url, /^https:\/\/wa\.me\/51968555200\?text=/);
  const message = decodeURIComponent(url.split("?text=")[1]);
  for (const value of ["PLUS", "persona@example.com", "968555200", "order-owned-123", "15.00"]) assert.ok(message.includes(value), value);
  assert.ok(message.includes("\n"));
  assert.equal(message.includes("pago ya fue verificado"), false);
});

test("PENDING_PAYMENT omite reference y usa texto de consulta", () => {
  const message = buildPaymentWhatsAppMessage({ ...base, order: { ...base.order, status: "PENDING_PAYMENT", reference: null } });
  assert.match(message, /consultar sobre esta solicitud/);
  assert.equal(message.includes("número registrado"), false);
});

test("PENDING_REVIEW omite una reference ausente o inválida", () => {
  for (const reference of [null, "", "123", "not-phone"]) {
    const message = buildPaymentWhatsAppMessage({ ...base, order: { ...base.order, reference } });
    assert.equal(message.includes("número registrado"), false);
  }
});

test("solo permite los estados de contacto definidos", () => {
  assert.equal(isPaymentWhatsAppStatus("PENDING_PAYMENT"), true);
  assert.equal(isPaymentWhatsAppStatus("PENDING_REVIEW"), true);
  for (const status of ["APPROVED", "REJECTED", "CANCELLED", "CANCELLED_BY_USER"]) {
    assert.equal(isPaymentWhatsAppStatus(status), false);
    assert.throws(() => buildPaymentWhatsAppUrl({ ...base, order: { ...base.order, status } }), /STATUS_INVALID/);
  }
});

test("rechaza números que no sean dígitos internacionales válidos", () => {
  for (const phone of ["+51968555200", "51 968555200", "51-968555200", "051968555200", "123", ""]) {
    assert.throws(() => buildPaymentWhatsAppUrl({ ...base, phone }), /PHONE_INVALID/);
  }
});

test("no incorpora campos sensibles ni propiedades adicionales", () => {
  const input = {
    ...base,
    password: "password-secret-value",
    cookie: "cookie-secret-value",
    token: "token-secret-value",
    csrf: "csrf-secret-value",
    secret: "private-secret-value",
  };
  const message = buildPaymentWhatsAppMessage(input);
  for (const forbidden of ["password", "cookie", "token", "csrf", "secret-value"]) {
    assert.equal(message.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("rechaza datos comerciales obligatorios ausentes o inválidos", () => {
  assert.throws(() => buildPaymentWhatsAppUrl({ ...base, email: "" }), /DATA_MISSING/);
  assert.throws(() => buildPaymentWhatsAppUrl({ ...base, order: { ...base.order, id: "" } }), /DATA_MISSING/);
  assert.throws(() => buildPaymentWhatsAppUrl({ ...base, order: { ...base.order, plan: null } }), /DATA_MISSING/);
  assert.throws(() => buildPaymentWhatsAppUrl({ ...base, order: { ...base.order, amountMinor: -1 } }), /DATA_INVALID/);
});
