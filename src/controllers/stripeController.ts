import { Response, Request } from 'express';
import Stripe from 'stripe';
import { TenantRequest } from '../types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-09-30.acquirer' as any });

class StripeController {
  async createCheckoutSession(req: TenantRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const priceId = (req.body?.priceId || '').toString();
      const quantity = Number(req.body?.quantity || 1);
      const successUrl = (req.body?.successUrl || process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/?checkout=success').toString();
      const cancelUrl = (req.body?.cancelUrl || process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/?checkout=cancel').toString();

      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Stripe not configured' });
      }
      if (!priceId) {
        return res.status(400).json({ error: 'priceId is required' });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [ { price: priceId, quantity } ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: req.user.email,
        metadata: { userId: req.user.id, tenantId: req.user.tenantId || '' },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create checkout session', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async webhook(req: Request, res: Response) {
    try {
      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        return res.status(400).send('Missing stripe-signature header');
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
        return res.status(500).send('Stripe not configured');
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        return res.status(400).send(`Webhook Error: ${(err as any)?.message || 'invalid signature'}`);
      }

      switch (event.type) {
        case 'checkout.session.completed':
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'invoice.payment_succeeded':
          break;
        default:
          break;
      }

      res.json({ received: true });
    } catch (error) {
      res.status(400).send('Webhook handling failed');
    }
  }
}

export const stripeController = new StripeController();