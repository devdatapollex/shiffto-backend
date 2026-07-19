import Stripe from "stripe";
import {
  CheckoutSessionResult,
  CreateCheckoutSessionPayload,
  IPaymentGatewayAdapter,
} from "./payment.interface";

export class StripeAdapter implements IPaymentGatewayAdapter {
  private stripe: Stripe | null = null;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  async createCheckoutSession(
    payload: CreateCheckoutSessionPayload,
  ): Promise<CheckoutSessionResult> {
    if (!this.stripe) {
      throw new Error(
        "STRIPE_SECRET_KEY is not configured in environment variables",
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (payload.currency || "usd").toLowerCase(),
            product_data: {
              name: `Shiffto Delivery Fee: ${payload.itemName}`,
              description: `Escrow payment for Shipment ID: ${payload.shipmentId}`,
            },
            unit_amount: Math.round(payload.amount * 100), // convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes expiration
      customer_email: payload.senderEmail,
      client_reference_id: payload.transactionId,
      metadata: {
        transactionId: payload.transactionId,
        shipmentId: payload.shipmentId,
      },
      success_url: payload.successUrl,
      cancel_url: payload.cancelUrl,
    });

    return {
      checkoutUrl: session.url || payload.successUrl,
      sessionGatewayId: session.id,
    };
  }

  verifyWebhookEvent(rawBody: Buffer | string, signature: string) {
    if (!this.stripe) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  }
}

export const getPaymentAdapter = (): IPaymentGatewayAdapter => {
  return new StripeAdapter();
};
