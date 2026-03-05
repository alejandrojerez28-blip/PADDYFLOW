import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { processors } from '../db/schema.js';
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
  contactName: z.string().max(255).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

/**
 * GET /api/processors?search=&active=
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
      const conditions = [eq(processors.tenantId, req.tenantId)];
      if (search && search.trim()) {
        conditions.push(ilike(processors.name, `%${search.trim()}%`));
      }
      if (active === 'true') conditions.push(eq(processors.isActive, true));
      else if (active === 'false') conditions.push(eq(processors.isActive, false));

      const list = await db
        .select()
        .from(processors)
        .where(and(...conditions))
        .orderBy(desc(processors.createdAt))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Processors list error:', err);
      res.status(500).json({ error: 'Error al listar procesadores' });
    }
  }
);

/**
 * POST /api/processors
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
      res.status(403).json({ error: 'Sin permiso para crear procesadores' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [inserted] = await db
        .insert(processors)
        .values({
          tenantId: req.tenantId,
          name: parsed.data.name,
          contactName: parsed.data.contactName ?? null,
          phone: parsed.data.phone ?? null,
          address: parsed.data.address ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Processor create error:', err);
      res.status(500).json({ error: 'Error al crear procesador' });
    }
  }
);

/**
 * PUT /api/processors/:id
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
      res.status(403).json({ error: 'Sin permiso para editar procesadores' });
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
      .from(processors)
      .where(and(eq(processors.id, id), eq(processors.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Procesador no encontrado' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.contactName !== undefined) updates.contactName = parsed.data.contactName ?? null;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone ?? null;
    if (parsed.data.address !== undefined) updates.address = parsed.data.address ?? null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    try {
      const [updated] = await db
        .update(processors)
        .set(updates as Record<string, string | Date | boolean | null>)
        .where(eq(processors.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Processor update error:', err);
      res.status(500).json({ error: 'Error al actualizar procesador' });
    }
  }
);

/**
 * DELETE /api/processors/:id (soft delete: is_active=false)
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
      res.status(403).json({ error: 'Sin permiso para eliminar procesadores' });
      return;
    }

    const id = req.params.id;
    const [updated] = await db
      .update(processors)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(processors.id, id), eq(processors.tenantId, req.tenantId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Procesador no encontrado' });
      return;
    }

    res.json(updated);
  }
);

export default router;
