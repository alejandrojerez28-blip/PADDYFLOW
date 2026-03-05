import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { suppliers } from '../db/schema.js';
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
  rncOrId: z.string().max(64).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({ isActive: z.boolean().optional() });

/**
 * GET /api/suppliers?search=&active=
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
      const conditions = [eq(suppliers.tenantId, req.tenantId)];
      if (search && search.trim()) {
        conditions.push(ilike(suppliers.name, `%${search.trim()}%`));
      }
      if (active === 'true') conditions.push(eq(suppliers.isActive, true));
      else if (active === 'false') conditions.push(eq(suppliers.isActive, false));

      const list = await db
        .select()
        .from(suppliers)
        .where(and(...conditions))
        .orderBy(desc(suppliers.createdAt))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Suppliers list error:', err);
      res.status(500).json({ error: 'Error al listar proveedores' });
    }
  }
);

/**
 * POST /api/suppliers
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
      res.status(403).json({ error: 'Sin permiso para crear proveedores' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [inserted] = await db
        .insert(suppliers)
        .values({
          tenantId: req.tenantId,
          name: parsed.data.name,
          rncOrId: parsed.data.rncOrId ?? null,
          phone: parsed.data.phone ?? null,
          address: parsed.data.address ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Supplier create error:', err);
      res.status(500).json({ error: 'Error al crear proveedor' });
    }
  }
);

/**
 * PUT /api/suppliers/:id
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
      res.status(403).json({ error: 'Sin permiso para editar proveedores' });
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
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.rncOrId !== undefined) updates.rncOrId = parsed.data.rncOrId ?? null;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone ?? null;
    if (parsed.data.address !== undefined) updates.address = parsed.data.address ?? null;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    try {
      const [updated] = await db
        .update(suppliers)
        .set(updates as Record<string, string | Date | boolean | null>)
        .where(eq(suppliers.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Supplier update error:', err);
      res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
  }
);

/**
 * DELETE /api/suppliers/:id (soft delete: is_active=false)
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
      res.status(403).json({ error: 'Sin permiso para eliminar proveedores' });
      return;
    }

    const id = req.params.id;
    const [updated] = await db
      .update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(suppliers.id, id), eq(suppliers.tenantId, req.tenantId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    res.json(updated);
  }
);

export default router;
