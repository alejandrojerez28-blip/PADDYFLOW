import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { items } from '../db/schema.js';
import { eq, and, desc, ilike } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'OperadorPesada', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().max(64).optional().nullable(),
  category: z.enum(['FINISHED', 'SUBPRODUCT', 'OTHER']),
  uom: z.string().max(16).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * GET /api/items?search=&category=&active=
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

    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const active = req.query.active as string | undefined;

    try {
      const conditions = [eq(items.tenantId, req.tenantId)];
      if (search && search.trim()) {
        conditions.push(ilike(items.name, `%${search.trim()}%`));
      }
      if (category && ['FINISHED', 'SUBPRODUCT', 'OTHER'].includes(category)) {
        conditions.push(eq(items.category, category as 'FINISHED' | 'SUBPRODUCT' | 'OTHER'));
      }
      if (active === 'true') conditions.push(eq(items.isActive, true));
      else if (active === 'false') conditions.push(eq(items.isActive, false));

      const list = await db
        .select()
        .from(items)
        .where(and(...conditions))
        .orderBy(desc(items.createdAt))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Items list error:', err);
      res.status(500).json({ error: 'Error al listar items' });
    }
  }
);

/**
 * POST /api/items
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
      res.status(403).json({ error: 'Sin permiso para crear items' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [inserted] = await db
        .insert(items)
        .values({
          tenantId: req.tenantId,
          name: parsed.data.name,
          sku: parsed.data.sku ?? null,
          category: parsed.data.category,
          uom: parsed.data.uom ?? 'kg',
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Items create error:', err);
      res.status(500).json({ error: 'Error al crear item' });
    }
  }
);

/**
 * PUT /api/items/:id
 */
router.put(
  '/:id',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para editar items' });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [existing] = await db
        .select()
        .from(items)
        .where(and(eq(items.id, req.params.id), eq(items.tenantId, req.tenantId)));

      if (!existing) {
        res.status(404).json({ error: 'Item no encontrado' });
        return;
      }

      const [updated] = await db
        .update(items)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(eq(items.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Items update error:', err);
      res.status(500).json({ error: 'Error al actualizar item' });
    }
  }
);

/**
 * DELETE /api/items/:id (soft: is_active=false)
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para eliminar items' });
      return;
    }

    try {
      const [existing] = await db
        .select()
        .from(items)
        .where(and(eq(items.id, req.params.id), eq(items.tenantId, req.tenantId)));

      if (!existing) {
        res.status(404).json({ error: 'Item no encontrado' });
        return;
      }

      const [updated] = await db
        .update(items)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(items.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Items delete error:', err);
      res.status(500).json({ error: 'Error al eliminar item' });
    }
  }
);

export default router;
