import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';
import fiscalProfileRoutes from './fiscalProfile.js';

const router = Router();

/**
 * GET /api/tenants/me
 * Endpoint protegido de ejemplo: devuelve el tenant y usuario actual.
 * Demuestra el flujo: auth -> tenantContext -> requireTenant
 */
router.get(
  '/me',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  (req, res) => {
    if (!req.user || !req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const { passwordHash: _, tenant, ...userSafe } = req.user;

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        subscriptionStatus: tenant.subscriptionStatus,
        currentPeriodEnd: tenant.currentPeriodEnd,
        country: tenant.country,
        onboardingStatus: tenant.onboardingStatus,
        taxMode: tenant.taxMode,
        ecfProvider: tenant.ecfProvider,
      },
      user: {
        id: userSafe.id,
        email: userSafe.email,
        name: userSafe.name,
        role: userSafe.role,
        tenantId: userSafe.tenantId,
      },
      tenantId: req.tenantId,
    });
  }
);

router.use('/', fiscalProfileRoutes);

export default router;
