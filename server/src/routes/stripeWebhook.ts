import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db/index.js';
import { tenants, billingEvents } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

function resolvePlanFromPriceId(priceId: string): 'basic' | 'pro' {
  const priceBasic = process.env.STRIPE_PRICE_BASIC;
  const pricePro = process.env.STRIPE_PRICE_PRO;
  if (pricePro && priceId === pricePro) return 'pro';
  return 'basic';
}

async function ensureEventIdempotency(
  stripeEventId: string,
  type: string,
  tenantId: string | null,
  payload: unknown
): Promise<boolean> {
  try {
    await db.insert(billingEvents).values({
      tenantId,
      stripeEventId,
      type,
      payload:
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : { raw: String(payload) },
    });
    return true;
  } catch {
    return false;
  }
}

async function updateTenantFromSubscription(sub: Stripe.Subscription) {
  const tenantId =
    (sub.metadata?.tenantId as string) ?? null;
  if (!tenantId) return;

  const status = sub.status as SubscriptionStatus;
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const plan = priceId ? resolvePlanFromPriceId(priceId) : 'basic';

  const updateData: Record<string, unknown> = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: status,
    stripePriceId: priceId,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    subscriptionUpdatedAt: new Date(),
    plan,
    hadSubscriptionBefore: true,
    updatedAt: new Date(),
  };

  await db.update(tenants).set(updateData as never).where(eq(tenants.id, tenantId));
}

async function updateTenantFromCustomerId(
  stripeCustomerId: string,
  subscriptionId: string | null,
  status: SubscriptionStatus | null,
  priceId: string | null,
  currentPeriodEnd: Date | null,
  trialEndsAt: Date | null
) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!tenant) return;

  const plan = priceId ? resolvePlanFromPriceId(priceId) : tenant.plan;

  await db
    .update(tenants)
    .set({
      stripeSubscriptionId: subscriptionId ?? tenant.stripeSubscriptionId,
      subscriptionStatus: status ?? tenant.subscriptionStatus,
      stripePriceId: priceId ?? tenant.stripePriceId,
      currentPeriodEnd: currentPeriodEnd ?? tenant.currentPeriodEnd,
      trialEndsAt: trialEndsAt ?? tenant.trialEndsAt,
      subscriptionUpdatedAt: new Date(),
      plan,
      hadSubscriptionBefore: true,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));
}

/**
 * POST /api/stripe/webhook
 * Webhook de Stripe - requiere raw body para validar firma
 */
router.post(
  '/webhook',
  async (req: Request, res: Response): Promise<void> => {
    if (!webhookSecret || !stripe) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('STRIPE_WEBHOOK_SECRET o STRIPE_SECRET_KEY no configurado');
      }
      res.status(500).json({ error: 'Webhook no configurado' });
      return;
    }

    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) {
      res.status(400).json({ error: 'Falta stripe-signature' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret
      );
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Webhook signature verification failed');
      }
      res.status(400).json({ error: 'Firma de webhook inválida' });
      return;
    }

    const obj = event.data?.object as { metadata?: { tenantId?: string } } | undefined;
    const tenantIdFromMeta = obj?.metadata?.tenantId ?? null;
    const inserted = await ensureEventIdempotency(
      event.id,
      event.type,
      tenantIdFromMeta,
      { id: event.id, type: event.type, livemode: event.livemode }
    );

    if (!inserted) {
      res.status(200).json({ received: true });
      return;
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          await updateTenantFromSubscription(sub);
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const tenantId = sub.metadata?.tenantId as string | undefined;
          if (tenantId) {
            await db
              .update(tenants)
              .set({
                stripeSubscriptionId: null,
                subscriptionStatus: 'canceled',
                stripePriceId: null,
                currentPeriodEnd: null,
                trialEndsAt: null,
                subscriptionUpdatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(tenants.id, tenantId));
          } else {
            const [tenant] = await db
              .select()
              .from(tenants)
              .where(eq(tenants.stripeSubscriptionId, sub.id))
              .limit(1);
            if (tenant) {
              await db
                .update(tenants)
                .set({
                  stripeSubscriptionId: null,
                  subscriptionStatus: 'canceled',
                  stripePriceId: null,
                  currentPeriodEnd: null,
                  trialEndsAt: null,
                  subscriptionUpdatedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(tenants.id, tenant.id));
            }
          }
          break;
        }
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.subscription && session.customer) {
            const sub = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            await updateTenantFromSubscription(sub);
          }
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string | null;
          const customerId = invoice.customer as string | null;
          if (subId) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await updateTenantFromSubscription(sub);
          } else if (customerId) {
            await updateTenantFromCustomerId(
              customerId,
              null,
              'active',
              null,
              null,
              null
            );
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string | null;
          if (subId && stripe) {
            const sub = await stripe.subscriptions.retrieve(subId);
            await updateTenantFromSubscription(sub);
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Webhook handler error:', err);
      } else {
        console.error('Webhook handler error');
      }
    }

    res.status(200).json({ received: true });
  }
);

export default router;
