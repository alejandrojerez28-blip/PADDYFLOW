import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tenants } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';
import { getTenantFeatures } from '../lib/billingFeatures.js';

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const BLOCKED_STATUSES = ['past_due', 'canceled', 'unpaid', 'incomplete_expired'] as const;
const TRIAL_DAYS = 15;

/**
 * GET /api/billing/status
 * Devuelve estado de suscripción del tenant
 */
router.get(
  '/status',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !req.user) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.tenantId))
        .limit(1);

      if (!tenant) {
        res.status(404).json({ error: 'Tenant no encontrado' });
        return;
      }

      const plan = (tenant.plan ?? 'basic') as 'basic' | 'pro';
      const features = getTenantFeatures(plan);
      const isBlocked =
        tenant.subscriptionStatus != null &&
        BLOCKED_STATUSES.includes(tenant.subscriptionStatus as (typeof BLOCKED_STATUSES)[number]);

      res.json({
        tenantId: tenant.id,
        subscriptionStatus: tenant.subscriptionStatus ?? 'no_subscription',
        plan,
        currentPeriodEnd: tenant.currentPeriodEnd,
        trialEndsAt: tenant.trialEndsAt,
        isBlocked,
        features,
      });
    } catch (err) {
      console.error('Billing status error:', err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

const checkoutSchema = z.object({
  plan: z.enum(['basic', 'pro']),
});

/**
 * POST /api/billing/checkout-session
 * Crea Stripe Checkout Session para suscripción
 */
router.post(
  '/checkout-session',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !req.user) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Plan inválido', details: parsed.error.flatten() });
      return;
    }

    const { plan } = parsed.data;
    const priceId =
      plan === 'pro'
        ? process.env.STRIPE_PRICE_PRO
        : process.env.STRIPE_PRICE_BASIC;

    if (!priceId) {
      res.status(500).json({ error: 'Precio no configurado para este plan' });
      return;
    }

    if (!stripe) {
      res.status(503).json({ error: 'Billing no configurado (STRIPE_SECRET_KEY)' });
      return;
    }

    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.tenantId))
        .limit(1);

      if (!tenant) {
        res.status(404).json({ error: 'Tenant no encontrado' });
        return;
      }

      // Si ya tiene suscripción activa, redirigir al portal
      if (
        tenant.stripeSubscriptionId &&
        ['trialing', 'active'].includes(tenant.subscriptionStatus ?? '')
      ) {
        res.status(400).json({
          error: 'Ya tienes una suscripción activa',
          code: 'ALREADY_SUBSCRIBED',
          redirectToPortal: true,
        });
        return;
      }

      let customerId = tenant.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: tenant.name,
          metadata: { tenantId: req.tenantId },
        });
        customerId = customer.id;
        await db
          .update(tenants)
          .set({
            stripeCustomerId: customerId,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, req.tenantId));
      }

      const applyTrial = !tenant.hadSubscriptionBefore;
      const subscriptionData: Stripe.Checkout.SessionCreateParams['subscription_data'] = {
        metadata: { tenantId: req.tenantId },
        trial_period_days: applyTrial ? TRIAL_DAYS : undefined,
      };

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: subscriptionData,
        success_url: `${appBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/billing/cancel`,
        metadata: { tenantId: req.tenantId, plan },
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('Checkout session error:', err);
      res.status(500).json({ error: 'Error al crear sesión de checkout' });
    }
  }
);

/**
 * POST /api/billing/portal-session
 * Crea Customer Portal Session
 */
router.post(
  '/portal-session',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !req.user) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    if (!stripe) {
      res.status(503).json({ error: 'Billing no configurado (STRIPE_SECRET_KEY)' });
      return;
    }

    const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.tenantId))
        .limit(1);

      if (!tenant?.stripeCustomerId) {
        res.status(400).json({
          error: 'No hay cuenta de facturación. Suscríbete primero.',
          code: 'NO_CUSTOMER',
        });
        return;
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${appBaseUrl}/settings/billing`,
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('Portal session error:', err);
      res.status(500).json({ error: 'Error al crear sesión del portal' });
    }
  }
);

export default router;
