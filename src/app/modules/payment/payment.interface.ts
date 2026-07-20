export interface CreateCheckoutSessionPayload {
  transactionId: string;
  shipmentId: string;
  itemName: string;
  amount: number;
  currency?: string;
  senderEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionGatewayId: string;
}

export interface IPaymentGatewayAdapter {
  createCheckoutSession(
    payload: CreateCheckoutSessionPayload,
  ): Promise<CheckoutSessionResult>;
  verifyWebhookEvent?(rawBody: Buffer | string, signature: string): any;
}
