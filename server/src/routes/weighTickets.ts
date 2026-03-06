import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { weighTickets, tenants, suppliers, drivers, trucks, weighTicketQuality } from '../db/schema.js';
import { eq, and, desc, gte, lte, ilike } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';
import { allocateDocumentNumber } from '../lib/documentNumber.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'OperadorPesada', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const baseSchema = z.object({
  type: z.enum(['PADDY', 'SUBPRODUCT', 'OTHER']),
  datetime: z.string().min(1).refine((s) => !isNaN(new Date(s).getTime()), { message: 'Fecha inválida' }),
  supplierId: z.string().uuid().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  truckId: z.string().uuid().optional().nullable(),
  grossKg: z.number().min(0),
  tareKg: z.number().min(0),
  notes: z.string().max(1024).optional().nullable(),
});

const createSchema = baseSchema.refine((d) => d.grossKg >= d.tareKg, { message: 'Bruto debe ser >= tara', path: ['grossKg'] });

const updateSchema = baseSchema.partial().refine(
  (d: { grossKg?: number; tareKg?: number }) => {
    if (d.grossKg !== undefined && d.tareKg !== undefined) return d.grossKg >= d.tareKg;
    return true;
  },
  { message: 'Bruto debe ser >= tara', path: ['grossKg'] }
);

/**
 * GET /api/weigh-tickets
 * Listar pesadas con filtros
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

    const type = req.query.type as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const driverId = req.query.driverId as string | undefined;
    const truckId = req.query.truckId as string | undefined;
    const search = req.query.search as string | undefined;

    try {
      const conditions = [eq(weighTickets.tenantId, req.tenantId)];
      if (type && ['PADDY', 'SUBPRODUCT', 'OTHER'].includes(type)) {
        conditions.push(eq(weighTickets.type, type as 'PADDY' | 'SUBPRODUCT' | 'OTHER'));
      }
      if (dateFrom) {
        conditions.push(gte(weighTickets.datetime, new Date(dateFrom + 'T00:00:00Z')));
      }
      if (dateTo) {
        conditions.push(lte(weighTickets.datetime, new Date(dateTo + 'T23:59:59.999Z')));
      }
      if (supplierId) conditions.push(eq(weighTickets.supplierId, supplierId));
      if (driverId) conditions.push(eq(weighTickets.driverId, driverId));
      if (truckId) conditions.push(eq(weighTickets.truckId, truckId));
      if (search && search.trim()) {
        conditions.push(ilike(weighTickets.notes, `%${search.trim()}%`));
      }

      const rows = await db
        .select({
          id: weighTickets.id,
          ticketNumber: weighTickets.ticketNumber,
          type: weighTickets.type,
          datetime: weighTickets.datetime,
          supplierId: weighTickets.supplierId,
          driverId: weighTickets.driverId,
          truckId: weighTickets.truckId,
          grossKg: weighTickets.grossKg,
          tareKg: weighTickets.tareKg,
          netKg: weighTickets.netKg,
          notes: weighTickets.notes,
          createdBy: weighTickets.createdBy,
          createdAt: weighTickets.createdAt,
          updatedAt: weighTickets.updatedAt,
          tenantId: weighTickets.tenantId,
          supplierName: suppliers.name,
          driverName: drivers.name,
          truckPlate: trucks.plate,
          qualityId: weighTicketQuality.id,
        })
        .from(weighTickets)
        .leftJoin(suppliers, and(eq(weighTickets.supplierId, suppliers.id), eq(suppliers.tenantId, req.tenantId!)))
        .leftJoin(drivers, and(eq(weighTickets.driverId, drivers.id), eq(drivers.tenantId, req.tenantId!)))
        .leftJoin(trucks, and(eq(weighTickets.truckId, trucks.id), eq(trucks.tenantId, req.tenantId!)))
        .leftJoin(
          weighTicketQuality,
          and(eq(weighTicketQuality.weighTicketId, weighTickets.id), eq(weighTicketQuality.tenantId, req.tenantId!))
        )
        .where(and(...conditions))
        .orderBy(desc(weighTickets.datetime))
        .limit(500);

      const list = rows.map((r) => ({
        ...r,
        supplierName: r.supplierName ?? null,
        driverName: r.driverName ?? null,
        truckPlate: r.truckPlate ?? null,
        hasQuality: !!r.qualityId,
      }));

      res.json(list);
    } catch (err) {
      console.error('Weigh tickets list error:', err);
      res.status(500).json({ error: 'Error al listar pesadas' });
    }
  }
);

const qualitySchema = z.object({
  sampleDate: z.string().optional(),
  moisturePct: z.number().min(0).max(100).optional().nullable(),
  impurityPct: z.number().min(0).max(100).optional().nullable(),
  brokenPct: z.number().min(0).max(100).optional().nullable(),
  chalkyPct: z.number().min(0).max(100).optional().nullable(),
  remarks: z.string().max(1024).optional().nullable(),
});

/**
 * GET /api/weigh-tickets/:id/quality
 */
router.get(
  '/:id/quality',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    const id = req.params.id;
    try {
      const [row] = await db
        .select()
        .from(weighTicketQuality)
        .where(and(eq(weighTicketQuality.weighTicketId, id), eq(weighTicketQuality.tenantId, req.tenantId!)))
        .limit(1);
      if (!row) {
        res.status(404).json({ error: 'No hay análisis de calidad para esta pesada' });
        return;
      }
      res.json(row);
    } catch (err) {
      console.error('Weigh ticket quality get error:', err);
      res.status(500).json({ error: 'Error al obtener análisis' });
    }
  }
);

/**
 * POST /api/weigh-tickets/:id/quality (upsert)
 */
router.post(
  '/:id/quality',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para registrar análisis' });
      return;
    }
    const id = req.params.id;
    const parsed = qualitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [ticket] = await db
      .select({ id: weighTickets.id })
      .from(weighTickets)
      .where(and(eq(weighTickets.id, id), eq(weighTickets.tenantId, req.tenantId!)))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: 'Pesada no encontrada' });
      return;
    }

    const { sampleDate, moisturePct, impurityPct, brokenPct, chalkyPct, remarks } = parsed.data;
    try {
      const [existing] = await db
        .select()
        .from(weighTicketQuality)
        .where(and(eq(weighTicketQuality.weighTicketId, id), eq(weighTicketQuality.tenantId, req.tenantId!)))
        .limit(1);

      const values = {
        tenantId: req.tenantId,
        weighTicketId: id,
        sampleDate: sampleDate ? new Date(sampleDate) : new Date(),
        moisturePct: moisturePct != null ? String(moisturePct) : null,
        impurityPct: impurityPct != null ? String(impurityPct) : null,
        brokenPct: brokenPct != null ? String(brokenPct) : null,
        chalkyPct: chalkyPct != null ? String(chalkyPct) : null,
        remarks: remarks ?? null,
        createdBy: req.user?.id ?? null,
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(weighTicketQuality)
          .set(values)
          .where(eq(weighTicketQuality.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        const [inserted] = await db.insert(weighTicketQuality).values(values).returning();
        res.status(201).json(inserted);
      }
    } catch (err) {
      console.error('Weigh ticket quality upsert error:', err);
      res.status(500).json({ error: 'Error al guardar análisis' });
    }
  }
);

/**
 * GET /api/weigh-tickets/:id
 * Detalle de una pesada (para impresión)
 */
router.get(
  '/:id',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const id = req.params.id;
    try {
      const [row] = await db
        .select({
          id: weighTickets.id,
          ticketNumber: weighTickets.ticketNumber,
          type: weighTickets.type,
          datetime: weighTickets.datetime,
          supplierId: weighTickets.supplierId,
          driverId: weighTickets.driverId,
          truckId: weighTickets.truckId,
          grossKg: weighTickets.grossKg,
          tareKg: weighTickets.tareKg,
          netKg: weighTickets.netKg,
          notes: weighTickets.notes,
          createdAt: weighTickets.createdAt,
          updatedAt: weighTickets.updatedAt,
          supplierName: suppliers.name,
          driverName: drivers.name,
          truckPlate: trucks.plate,
        })
        .from(weighTickets)
        .leftJoin(suppliers, and(eq(weighTickets.supplierId, suppliers.id), eq(suppliers.tenantId, req.tenantId!)))
        .leftJoin(drivers, and(eq(weighTickets.driverId, drivers.id), eq(drivers.tenantId, req.tenantId!)))
        .leftJoin(trucks, and(eq(weighTickets.truckId, trucks.id), eq(trucks.tenantId, req.tenantId!)))
        .where(and(eq(weighTickets.id, id), eq(weighTickets.tenantId, req.tenantId!)))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: 'Pesada no encontrada' });
        return;
      }

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, req.tenantId)).limit(1);
      res.json({
        ...row,
        supplierName: row.supplierName ?? null,
        driverName: row.driverName ?? null,
        truckPlate: row.truckPlate ?? null,
        tenant: tenant ?? null,
      });
    } catch (err) {
      console.error('Weigh ticket get error:', err);
      res.status(500).json({ error: 'Error al obtener pesada' });
    }
  }
);

/**
 * POST /api/weigh-tickets
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
      res.status(403).json({ error: 'Sin permiso para crear pesadas' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const { type, datetime, supplierId, driverId, truckId, grossKg, tareKg, notes } = parsed.data;
    const netKg = grossKg - tareKg;
    const dt = new Date(datetime);

    try {
      const ticketNumber = await allocateDocumentNumber(req.tenantId, 'WEIGH_TICKET');
      const [inserted] = await db
        .insert(weighTickets)
        .values({
          tenantId: req.tenantId,
          ticketNumber,
          type,
          datetime: dt,
          supplierId: supplierId ?? null,
          driverId: driverId ?? null,
          truckId: truckId ?? null,
          grossKg: String(grossKg),
          tareKg: String(tareKg),
          netKg: String(netKg),
          notes: notes ?? null,
          createdBy: req.user?.id ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Weigh ticket create error:', err);
      res.status(500).json({ error: 'Error al crear pesada' });
    }
  }
);

/**
 * PUT /api/weigh-tickets/:id
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
      res.status(403).json({ error: 'Sin permiso para editar pesadas' });
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
      .from(weighTickets)
      .where(and(eq(weighTickets.id, id), eq(weighTickets.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Pesada no encontrada' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.type !== undefined) updates.type = parsed.data.type;
    if (parsed.data.datetime !== undefined) updates.datetime = new Date(parsed.data.datetime);
    if (parsed.data.supplierId !== undefined) updates.supplierId = parsed.data.supplierId ?? null;
    if (parsed.data.driverId !== undefined) updates.driverId = parsed.data.driverId ?? null;
    if (parsed.data.truckId !== undefined) updates.truckId = parsed.data.truckId ?? null;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes ?? null;

    let grossKg = parseFloat(existing.grossKg);
    let tareKg = parseFloat(existing.tareKg);
    if (parsed.data.grossKg !== undefined) grossKg = parsed.data.grossKg;
    if (parsed.data.tareKg !== undefined) tareKg = parsed.data.tareKg;
    const netKg = grossKg - tareKg;
    if (netKg < 0) {
      res.status(400).json({ error: 'Bruto debe ser >= tara' });
      return;
    }
    updates.grossKg = String(grossKg);
    updates.tareKg = String(tareKg);
    updates.netKg = String(netKg);
    updates.updatedAt = new Date();

    try {
      const [updated] = await db
        .update(weighTickets)
        .set(updates as Record<string, string | Date | null>)
        .where(eq(weighTickets.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Weigh ticket update error:', err);
      res.status(500).json({ error: 'Error al actualizar pesada' });
    }
  }
);

/**
 * DELETE /api/weigh-tickets/:id
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
      res.status(403).json({ error: 'Sin permiso para eliminar pesadas' });
      return;
    }

    const id = req.params.id;
    const [deleted] = await db
      .delete(weighTickets)
      .where(and(eq(weighTickets.id, id), eq(weighTickets.tenantId, req.tenantId!)))
      .returning({ id: weighTickets.id });

    if (!deleted) {
      res.status(404).json({ error: 'Pesada no encontrada' });
      return;
    }

    res.status(204).send();
  }
);

export default router;
