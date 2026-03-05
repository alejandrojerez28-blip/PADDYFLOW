import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { trucks } from '../db/schema.js';
import { eq, and, desc, ilike } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'OperadorPesada', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

const createSchema = z.object({
  plate: z.string().min(1).max(32).transform(normalizePlate),
  capacityKg: z.string().max(32).optional().nullable(),
  owner: z.string().max(255).optional().nullable(),
});

const updateSchema = z.object({
  plate: z.string().min(1).max(32).transform(normalizePlate).optional(),
  capacityKg: z.string().max(32).optional().nullable(),
  owner: z.string().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/trucks?search=&active=
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
      const conditions = [eq(trucks.tenantId, req.tenantId)];
      if (search && search.trim()) {
        conditions.push(ilike(trucks.plate, `%${search.trim()}%`));
      }
      if (active === 'true') conditions.push(eq(trucks.isActive, true));
      else if (active === 'false') conditions.push(eq(trucks.isActive, false));

      const list = await db
        .select()
        .from(trucks)
        .where(and(...conditions))
        .orderBy(desc(trucks.createdAt))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Trucks list error:', err);
      res.status(500).json({ error: 'Error al listar camiones' });
    }
  }
);

/**
 * POST /api/trucks
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
      res.status(403).json({ error: 'Sin permiso para crear camiones' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [inserted] = await db
        .insert(trucks)
        .values({
          tenantId: req.tenantId,
          plate: parsed.data.plate,
          capacityKg: parsed.data.capacityKg ?? null,
          owner: parsed.data.owner ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Truck create error:', err);
      res.status(500).json({ error: 'Error al crear camión' });
    }
  }
);

/**
 * PUT /api/trucks/:id
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
      res.status(403).json({ error: 'Sin permiso para editar camiones' });
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
      .from(trucks)
      .where(and(eq(trucks.id, id), eq(trucks.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Camión no encontrado' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.plate !== undefined) updates.plate = parsed.data.plate;
    if (parsed.data.capacityKg !== undefined) updates.capacityKg = parsed.data.capacityKg ?? null;
    if (parsed.data.owner !== undefined) updates.owner = parsed.data.owner ?? null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    try {
      const [updated] = await db
        .update(trucks)
        .set(updates as Record<string, string | Date | boolean | null>)
        .where(eq(trucks.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Truck update error:', err);
      res.status(500).json({ error: 'Error al actualizar camión' });
    }
  }
);

/**
 * DELETE /api/trucks/:id (soft delete)
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
      res.status(403).json({ error: 'Sin permiso para eliminar camiones' });
      return;
    }

    const id = req.params.id;
    const [updated] = await db
      .update(trucks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(trucks.id, id), eq(trucks.tenantId, req.tenantId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Camión no encontrado' });
      return;
    }

    res.json(updated);
  }
);

export default router;
