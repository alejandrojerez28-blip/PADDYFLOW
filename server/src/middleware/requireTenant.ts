import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware que exige que exista tenantId en el request.
 * Usar en rutas que requieren contexto multi-tenant.
 * DEBE ejecutarse después de authMiddleware + tenantContextMiddleware.
 */
export function requireTenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenantId) {
    res.status(403).json({
      error: 'Acceso denegado: se requiere contexto de tenant',
    });
    return;
  }
  next();
}
