import { getStripeSync } from './stripeClient';
import { fulfillTopUpFromSession } from './utils/fulfillTopUp';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        if (session?.metadata?.planType === "Top-up") {
          const result = await fulfillTopUpFromSession({
            payment_status: session.payment_status,
            payment_intent: session.payment_intent,
            metadata: session.metadata,
          });
          if (result.fulfilled) {
            console.log(`[Webhook] Top-up fulfilled: ${result.type}`, result);
          } else {
            console.warn(`[Webhook] Top-up not fulfilled: ${result.reason}`);
          }
        }
      }
    } catch (err: any) {
      console.error("[Webhook] Top-up fulfillment error:", err.message);
    }
  }
}
