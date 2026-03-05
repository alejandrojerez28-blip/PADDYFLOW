import type { Request, Response, NextFunction } from 'express';

const ALLOWED_READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Middleware que bloquea acciones write (POST/PUT/PATCH/DELETE) en módulos
 * de operaciones fiscales si el tenant no tiene onboardingStatus === 'FISCAL_READY'.
 * Excepción: PROFORMA siempre permitida.
 * Las lecturas (GET) siempre se permiten.
 *
 * Debe ejecutarse DESPUÉS de auth + tenantContext.
 * Se combina con requireActiveSubscription para billing.
 */
export function requireFiscalReadyForWritesMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (ALLOWED_READ_METHODS.includes(req.method)) {
    next();
    return;
  }

  if (!req.user?.tenant) {
    res.status(403).json({
      error: 'Setup required',
      code: 'SETUP_REQUIRED',
    });
    return;
  }

  const status = req.user.tenant.onboardingStatus;

  if (status === 'FISCAL_READY') {
    next();
    return;
  }

  res.status(402).json({
    error: 'Completa la configuración fiscal para registrar operaciones',
    code: 'SETUP_REQUIRED',
    onboardingStatus: status,
  });
}
