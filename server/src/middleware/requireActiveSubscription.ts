import type { Request, Response, NextFunction } from 'express';

const BLOCKED_STATUSES = ['past_due', 'canceled', 'unpaid', 'incomplete_expired'] as const;
const ALLOWED_READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Middleware que bloquea acciones "write" (POST/PUT/PATCH/DELETE) si la suscripción
 * está en past_due, canceled, unpaid o incomplete_expired.
 * Las lecturas (GET) siempre se permiten.
 */
export async function requireActiveSubscriptionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (ALLOWED_READ_METHODS.includes(req.method)) {
    next();
    return;
  }

  if (!req.user?.tenant) {
    res.status(403).json({
      error: 'Subscription required',
      code: 'BILLING_BLOCKED',
    });
    return;
  }

  const status = req.user.tenant.subscriptionStatus;
  const isTrialing = status === 'trialing';
  const isActive = status === 'active';
  const isBlocked =
    status != null && BLOCKED_STATUSES.includes(status as (typeof BLOCKED_STATUSES)[number]);

  if (isBlocked) {
    res.status(402).json({
      error: 'Subscription required. Please update your payment method.',
      code: 'BILLING_BLOCKED',
    });
    return;
  }

  if (!status || (status !== 'trialing' && status !== 'active')) {
    res.status(402).json({
      error: 'Subscription required',
      code: 'BILLING_BLOCKED',
    });
    return;
  }

  next();
}
