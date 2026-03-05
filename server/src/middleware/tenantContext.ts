import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware que inyecta tenantId en el request desde el usuario autenticado.
 * DEBE ejecutarse DESPUÉS del authMiddleware.
 * Garantiza que todas las queries puedan filtrar por tenantId.
 */
export function tenantContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.user?.tenantId) {
    req.tenantId = req.user.tenantId;
  }
  next();
}
