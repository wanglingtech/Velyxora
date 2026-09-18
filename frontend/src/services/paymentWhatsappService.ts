export type ContactablePaymentStatus = "PENDING_PAYMENT" | "PENDING_REVIEW";

export interface PaymentWhatsAppOrder {
  id: string;
  status: string;
  amountMinor: number;
  currency: string;
  reference?: string | null;
  plan?: { code?: string | null } | null;
}

export interface PaymentWhatsAppInput {
  phone: string;
  email: string;
  order: PaymentWhatsAppOrder;
}

export function isPaymentWhatsAppStatus(status: string): status is ContactablePaymentStatus {
  return status === "PENDING_PAYMENT" || status === "PENDING_REVIEW";
}

function validateInput({ phone, email, order }: PaymentWhatsAppInput) {
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw new Error("WHATSAPP_PHONE_INVALID");
  if (!email.trim() || !order.id.trim() || !order.plan?.code?.trim()) throw new Error("WHATSAPP_PAYMENT_DATA_MISSING");
  if (!Number.isSafeInteger(order.amountMinor) || order.amountMinor < 0 || !/^[A-Z]{3}$/.test(order.currency)) {
    throw new Error("WHATSAPP_PAYMENT_DATA_INVALID");
  }
  if (!isPaymentWhatsAppStatus(order.status)) throw new Error("WHATSAPP_PAYMENT_STATUS_INVALID");
}

export function buildPaymentWhatsAppMessage(input: PaymentWhatsAppInput): string {
  validateInput(input);
  const { order, email } = input;
  const amount = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: order.currency,
    minimumFractionDigits: 2,
  }).format(order.amountMinor / 100);
  const lines = [
    `Hola, deseo adquirir el plan ${order.plan!.code!.trim()} de VELYXORA.`,
    "",
    order.status === "PENDING_REVIEW"
      ? `He registrado mi solicitud de pago mediante Yape por ${amount}.`
      : `He creado una solicitud de pago mediante Yape por ${amount}.`,
    "",
    `Mi cuenta de VELYXORA es ${email.trim()}.`,
  ];
  if (order.status === "PENDING_REVIEW" && order.reference && /^\d{9}$/.test(order.reference)) {
    lines.push("", `El número registrado para identificar mi pago es ${order.reference}.`);
  }
  lines.push("", `Código de solicitud: ${order.id}.`, "");
  lines.push(order.status === "PENDING_REVIEW"
    ? "Solicito la verificación del pago y, si corresponde, la activación de mi plan."
    : "Deseo consultar sobre esta solicitud antes de enviarla a revisión.");
  lines.push("", "Gracias.");
  return lines.join("\n");
}

export function buildPaymentWhatsAppUrl(input: PaymentWhatsAppInput): string {
  const message = buildPaymentWhatsAppMessage(input);
  return `https://wa.me/${input.phone}?text=${encodeURIComponent(message)}`;
}
