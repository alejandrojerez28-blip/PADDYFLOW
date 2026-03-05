import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { drivers } from '../db/schema.js';
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
  idNumber: z.string().max(64).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  license: z.string().max(64).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

/**
 * GET /api/drivers?search=&active=
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
    const active = req.query.active as string | undefined;

    try {
      const conditions = [eq(drivers.tenantId, req.tenantId)];
      if (search && search.trim()) {
        conditions.push(ilike(drivers.name, `%${search.trim()}%`));
      }
      if (active === 'true') conditions.push(eq(drivers.isActive, true));
      else if (active === 'false') conditions.push(eq(drivers.isActive, false));

      const list = await db
        .select()
        .from(drivers)
        .where(and(...conditions))
        .orderBy(desc(drivers.createdAt))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Drivers list error:', err);
      res.status(500).json({ error: 'Error al listar choferes' });
    }
  }
);

/**
 * POST /api/drivers
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
      res.status(403).json({ error: 'Sin permiso para crear choferes' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [inserted] = await db
        .insert(drivers)
        .values({
          tenantId: req.tenantId,
          name: parsed.data.name,
          idNumber: parsed.data.idNumber ?? null,
          phone: parsed.data.phone ?? null,
          license: parsed.data.license ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Driver create error:', err);
      res.status(500).json({ error: 'Error al crear chofer' });
    }
  }
);

/**
 * PUT /api/drivers/:id
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
      res.status(403).json({ error: 'Sin permiso para editar choferes' });
      return;
    }

    const id = req.params.id;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [existing] = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Chofer no encontrado' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.idNumber !== undefined) updates.idNumber = parsed.data.idNumber ?? null;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone ?? null;
    if (parsed.data.license !== undefined) updates.license = parsed.data.license ?? null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    try {
      const [updated] = await db
        .update(drivers)
        .set(updates as Record<string, string | Date | boolean | null>)
        .where(eq(drivers.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Driver update error:', err);
      res.status(500).json({ error: 'Error al actualizar chofer' });
    }
  }
);

/**
 * DELETE /api/drivers/:id (soft delete)
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
      res.status(403).json({ error: 'Sin permiso para eliminar choferes' });
      return;
    }

    const id = req.params.id;
    const [updated] = await db
      .update(drivers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(drivers.id, id), eq(drivers.tenantId, req.tenantId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Chofer no encontrado' });
      return;
    }

    res.json(updated);
  }
);

export default router;
