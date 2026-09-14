export interface PaymentProvider {
  createCheckout(input: unknown): Promise<unknown>;
  handleWebhook(input: unknown): Promise<unknown>;
  verifyPayment(input: unknown): Promise<unknown>;
  activateSubscription(input: unknown): Promise<unknown>;
  cancelSubscription(input: unknown): Promise<unknown>;
}

// No implementation is registered in beta. Manual Yape review uses PaymentService
// and converges on the same Payment/CreditLedger records.
