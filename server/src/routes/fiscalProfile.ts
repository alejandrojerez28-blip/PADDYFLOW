import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const fiscalProfileSchema = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().optional(),
  rnc: z.string().min(1),
  fiscalAddress: z.string().min(1),
  fiscalEmail: z.string().email().optional(),
  fiscalPhone: z.string().optional(),
  itbisRegistered: z.boolean().default(true),
  defaultDocCurrency: z.enum(['DOP', 'USD']).default('DOP'),
});

/**
 * POST /api/tenants/fiscal-profile
 * Completar perfil fiscal RD (AdminTenant). Requiere country=DO.
 */
router.post(
  '/fiscal-profile',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !req.user) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    if (req.user.role !== 'AdminTenant') {
      res.status(403).json({ error: 'Solo AdminTenant puede completar perfil fiscal' });
      return;
    }

    const parsed = fiscalProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
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

      if (tenant.country !== 'DO') {
        res.status(400).json({ error: 'Perfil fiscal solo aplica para República Dominicana (country=DO)' });
        return;
      }

      const [updated] = await db
        .update(tenants)
        .set({
          legalName: parsed.data.legalName,
          tradeName: parsed.data.tradeName ?? parsed.data.legalName,
          rnc: parsed.data.rnc,
          fiscalAddress: parsed.data.fiscalAddress,
          fiscalEmail: parsed.data.fiscalEmail ?? null,
          fiscalPhone: parsed.data.fiscalPhone ?? null,
          itbisRegistered: parsed.data.itbisRegistered,
          defaultDocCurrency: parsed.data.defaultDocCurrency,
          onboardingStatus: 'FISCAL_PENDING',
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, req.tenantId))
        .returning();

      res.json({
        tenant: {
          id: updated!.id,
          onboardingStatus: updated!.onboardingStatus,
          legalName: updated!.legalName,
          rnc: updated!.rnc,
        },
      });
    } catch (err) {
      console.error('Fiscal profile error:', err);
      res.status(500).json({ error: 'Error al guardar perfil fiscal' });
    }
  }
);

/**
 * GET /api/tenants/fiscal-profile
 * Obtener perfil fiscal actual
 */
router.get(
  '/fiscal-profile',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    try {
      const [tenant] = await db
        .select({
          id: tenants.id,
          country: tenants.country,
          onboardingStatus: tenants.onboardingStatus,
          taxMode: tenants.taxMode,
          legalName: tenants.legalName,
          tradeName: tenants.tradeName,
          rnc: tenants.rnc,
          fiscalAddress: tenants.fiscalAddress,
          fiscalEmail: tenants.fiscalEmail,
          fiscalPhone: tenants.fiscalPhone,
          itbisRegistered: tenants.itbisRegistered,
          defaultDocCurrency: tenants.defaultDocCurrency,
          ecfProvider: tenants.ecfProvider,
        })
        .from(tenants)
        .where(eq(tenants.id, req.tenantId))
        .limit(1);

      if (!tenant) {
        res.status(404).json({ error: 'Tenant no encontrado' });
        return;
      }

      res.json(tenant);
    } catch (err) {
      console.error('Fiscal profile get error:', err);
      res.status(500).json({ error: 'Error al obtener perfil fiscal' });
    }
  }
);

export default router;
