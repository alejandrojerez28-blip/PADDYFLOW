import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { supplierPriceRules, suppliers } from '../db/schema.js';
import { eq, and, desc, lte } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const createSchema = z.object({
  effectiveFrom: z.string().refine((s) => !isNaN(new Date(s).getTime()), { message: 'Fecha inválida' }),
  basePricePerKg: z.number().min(0),
  currency: z.string().max(8).default('DOP'),
  moistureBasePct: z.number().min(0).max(100).default(14),
  moisturePenaltyPerPct: z.number().min(0).default(0),
  impurityBasePct: z.number().min(0).max(100).default(1),
  impurityPenaltyPerPct: z.number().min(0).default(0),
  roundingMode: z.enum(['NONE', 'ROUND_2', 'ROUND_0']).default('ROUND_2'),
  isActive: z.boolean().default(true),
});

const updateSchema = createSchema.partial();

/**
 * GET /api/price-rules?supplierId=&active=
 * Standalone list - mounted at /api/price-rules
 */
const listRouter = Router();
listRouter.get(
  '/',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    const supplierId = req.query.supplierId as string | undefined;
    const active = req.query.active as string | undefined;

    try {
      const conditions = [eq(supplierPriceRules.tenantId, req.tenantId)];
      if (supplierId) conditions.push(eq(supplierPriceRules.supplierId, supplierId));
      if (active === 'true') conditions.push(eq(supplierPriceRules.isActive, true));
      else if (active === 'false') conditions.push(eq(supplierPriceRules.isActive, false));

      const list = await db
        .select({
          id: supplierPriceRules.id,
          supplierId: supplierPriceRules.supplierId,
          supplierName: suppliers.name,
          effectiveFrom: supplierPriceRules.effectiveFrom,
          basePricePerKg: supplierPriceRules.basePricePerKg,
          currency: supplierPriceRules.currency,
          moistureBasePct: supplierPriceRules.moistureBasePct,
          moisturePenaltyPerPct: supplierPriceRules.moisturePenaltyPerPct,
          impurityBasePct: supplierPriceRules.impurityBasePct,
          impurityPenaltyPerPct: supplierPriceRules.impurityPenaltyPerPct,
          roundingMode: supplierPriceRules.roundingMode,
          isActive: supplierPriceRules.isActive,
          createdAt: supplierPriceRules.createdAt,
        })
        .from(supplierPriceRules)
        .leftJoin(suppliers, eq(supplierPriceRules.supplierId, suppliers.id))
        .where(and(...conditions))
        .orderBy(desc(supplierPriceRules.effectiveFrom))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Price rules list error:', err);
      res.status(500).json({ error: 'Error al listar reglas de precio' });
    }
  }
);

/**
 * GET /api/suppliers/:id/price-rules
 * Mounted at /:id/price-rules under suppliers, so param is "id"
 */
router.get(
  '/',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    const supplierId = req.params.id;

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, req.tenantId!)))
      .limit(1);
    if (!supplier) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    try {
      const list = await db
        .select()
        .from(supplierPriceRules)
        .where(and(eq(supplierPriceRules.supplierId, supplierId), eq(supplierPriceRules.tenantId, req.tenantId!)))
        .orderBy(desc(supplierPriceRules.effectiveFrom))
        .limit(50);

      res.json(list);
    } catch (err) {
      console.error('Supplier price rules list error:', err);
      res.status(500).json({ error: 'Error al listar reglas' });
    }
  }
);

/**
 * POST /api/suppliers/:id/price-rules
 */
router.post(
  '/',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para crear reglas de precio' });
      return;
    }
    const supplierId = req.params.id;

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, req.tenantId!)))
      .limit(1);
    if (!supplier) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const d = parsed.data;
    try {
      const [inserted] = await db
        .insert(supplierPriceRules)
        .values({
          tenantId: req.tenantId,
          supplierId,
          effectiveFrom: d.effectiveFrom,
          basePricePerKg: String(d.basePricePerKg),
          currency: d.currency,
          moistureBasePct: String(d.moistureBasePct),
          moisturePenaltyPerPct: String(d.moisturePenaltyPerPct),
          impurityBasePct: String(d.impurityBasePct),
          impurityPenaltyPerPct: String(d.impurityPenaltyPerPct),
          roundingMode: d.roundingMode,
          isActive: d.isActive,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Price rule create error:', err);
      res.status(500).json({ error: 'Error al crear regla' });
    }
  }
);

/**
 * PUT /api/suppliers/:id/price-rules/:ruleId
 */
router.put(
  '/:ruleId',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para editar reglas' });
      return;
    }
    const supplierId = req.params.id;
    const ruleId = req.params.ruleId;

    const [existing] = await db
      .select()
      .from(supplierPriceRules)
      .where(
        and(
          eq(supplierPriceRules.id, ruleId),
          eq(supplierPriceRules.supplierId, supplierId),
          eq(supplierPriceRules.tenantId, req.tenantId!)
        )
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.effectiveFrom !== undefined) updates.effectiveFrom = parsed.data.effectiveFrom;
    if (parsed.data.basePricePerKg !== undefined) updates.basePricePerKg = String(parsed.data.basePricePerKg);
    if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
    if (parsed.data.moistureBasePct !== undefined) updates.moistureBasePct = String(parsed.data.moistureBasePct);
    if (parsed.data.moisturePenaltyPerPct !== undefined)
      updates.moisturePenaltyPerPct = String(parsed.data.moisturePenaltyPerPct);
    if (parsed.data.impurityBasePct !== undefined) updates.impurityBasePct = String(parsed.data.impurityBasePct);
    if (parsed.data.impurityPenaltyPerPct !== undefined)
      updates.impurityPenaltyPerPct = String(parsed.data.impurityPenaltyPerPct);
    if (parsed.data.roundingMode !== undefined) updates.roundingMode = parsed.data.roundingMode;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    try {
      const [updated] = await db
        .update(supplierPriceRules)
        .set(updates as Record<string, string | Date | boolean>)
        .where(eq(supplierPriceRules.id, ruleId))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Price rule update error:', err);
      res.status(500).json({ error: 'Error al actualizar regla' });
    }
  }
);

/**
 * DELETE /api/suppliers/:id/price-rules/:ruleId
 */
router.delete(
  '/:supplierId/rules/:ruleId',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para eliminar reglas' });
      return;
    }
    const { supplierId, ruleId } = req.params;

    const [deleted] = await db
      .delete(supplierPriceRules)
      .where(
        and(
          eq(supplierPriceRules.id, ruleId),
          eq(supplierPriceRules.supplierId, supplierId),
          eq(supplierPriceRules.tenantId, req.tenantId!)
        )
      )
      .returning({ id: supplierPriceRules.id });

    if (!deleted) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }

    res.status(204).send();
  }
);

export { listRouter };
export default router;
