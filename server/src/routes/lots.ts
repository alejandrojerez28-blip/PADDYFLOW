import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  lots,
  lotInputs,
  shipments,
  bulkReceipts,
  bulkReceiptSplits,
  items,
  weighTickets,
  suppliers,
  drivers,
  trucks,
  processors,
} from '../db/schema.js';
import { eq, and, desc, gte, lte, ilike, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';
import { allocateDocumentNumber } from '../lib/documentNumber.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'OperadorPesada', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const createLotSchema = z.object({
  code: z.string().min(1).max(32).optional(),
  status: z.enum(['OPEN', 'SENT', 'RECEIVED', 'CLOSED']).optional(),
  notes: z.string().max(1024).optional().nullable(),
});

const updateLotSchema = createLotSchema.partial();

const addInputSchema = z.object({
  weighTicketId: z.string().uuid(),
});

const createShipmentSchema = z.object({
  processorId: z.string().uuid(),
  shipDate: z.string().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  truckId: z.string().uuid().optional().nullable(),
  shippedKg: z.number().min(0).optional().nullable(),
  status: z.enum(['CREATED', 'IN_TRANSIT', 'DELIVERED']).optional(),
  notes: z.string().max(1024).optional().nullable(),
});

const updateShipmentSchema = createShipmentSchema.partial();

const createReceiptSchema = z.object({
  receiptDate: z.string().min(1),
  superSacksCount: z.number().int().min(0).optional(),
  totalKg: z.number().min(0),
  notes: z.string().max(1024).optional().nullable(),
});

const updateReceiptSchema = createReceiptSchema.partial();

/**
 * GET /api/lots
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

    const status = req.query.status as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const search = req.query.search as string | undefined;

    try {
      const conditions = [eq(lots.tenantId, req.tenantId)];
      if (status && ['OPEN', 'SENT', 'RECEIVED', 'CLOSED'].includes(status)) {
        conditions.push(eq(lots.status, status as 'OPEN' | 'SENT' | 'RECEIVED' | 'CLOSED'));
      }
      if (dateFrom) {
        conditions.push(gte(lots.createdAt, new Date(dateFrom + 'T00:00:00Z')));
      }
      if (dateTo) {
        conditions.push(lte(lots.createdAt, new Date(dateTo + 'T23:59:59.999Z')));
      }
      if (search && search.trim()) {
        conditions.push(ilike(lots.code, `%${search.trim()}%`));
      }

      const list = await db
        .select()
        .from(lots)
        .where(and(...conditions))
        .orderBy(desc(lots.createdAt))
        .limit(200);

      const inputsByLot = await db
        .select({
          lotId: lotInputs.lotId,
          totalNetKg: lotInputs.netKg,
        })
        .from(lotInputs)
        .where(eq(lotInputs.tenantId, req.tenantId));

      const shipmentsByLot = await db
        .select({ lotId: shipments.lotId })
        .from(shipments)
        .where(eq(shipments.tenantId, req.tenantId));

      const receiptsByLot = await db
        .select({
          lotId: bulkReceipts.lotId,
          totalKg: bulkReceipts.totalKg,
        })
        .from(bulkReceipts)
        .where(eq(bulkReceipts.tenantId, req.tenantId));

      const inputSums = new Map<string, number>();
      for (const i of inputsByLot) {
        const sum = (inputSums.get(i.lotId) ?? 0) + parseFloat(i.totalNetKg);
        inputSums.set(i.lotId, sum);
      }
      const receiptSums = new Map<string, number>();
      for (const r of receiptsByLot) {
        const sum = (receiptSums.get(r.lotId) ?? 0) + parseFloat(r.totalKg);
        receiptSums.set(r.lotId, sum);
      }
      const hasShipment = new Set(shipmentsByLot.map((s) => s.lotId));

      const enriched = list.map((lot) => ({
        ...lot,
        totalInputKg: inputSums.get(lot.id) ?? 0,
        hasShipment: hasShipment.has(lot.id),
        totalReceivedKg: receiptSums.get(lot.id) ?? 0,
      }));

      res.json(enriched);
    } catch (err) {
      console.error('Lots list error:', err);
      res.status(500).json({ error: 'Error al listar lotes' });
    }
  }
);

/**
 * POST /api/lots
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
      res.status(403).json({ error: 'Sin permiso para crear lotes' });
      return;
    }

    const parsed = createLotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const code = parsed.data.code ?? (await allocateDocumentNumber(req.tenantId, 'LOT'));

    try {
      const [inserted] = await db
        .insert(lots)
        .values({
          tenantId: req.tenantId,
          code,
          status: parsed.data.status ?? 'OPEN',
          notes: parsed.data.notes ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Lot create error:', err);
      res.status(500).json({ error: 'Error al crear lote' });
    }
  }
);

/**
 * GET /api/lots/:id
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
      const [lot] = await db
        .select()
        .from(lots)
        .where(and(eq(lots.id, id), eq(lots.tenantId, req.tenantId!)))
        .limit(1);

      if (!lot) {
        res.status(404).json({ error: 'Lote no encontrado' });
        return;
      }

      const inputs = await db
        .select({
          id: lotInputs.id,
          weighTicketId: lotInputs.weighTicketId,
          netKg: lotInputs.netKg,
          createdAt: lotInputs.createdAt,
          datetime: weighTickets.datetime,
          type: weighTickets.type,
          supplierName: suppliers.name,
        })
        .from(lotInputs)
        .innerJoin(weighTickets, eq(lotInputs.weighTicketId, weighTickets.id))
        .leftJoin(suppliers, and(eq(weighTickets.supplierId, suppliers.id), eq(suppliers.tenantId, req.tenantId!)))
        .where(and(eq(lotInputs.lotId, id), eq(lotInputs.tenantId, req.tenantId!)))
        .orderBy(desc(lotInputs.createdAt));

      const lotShipments = await db
        .select({
          id: shipments.id,
          processorId: shipments.processorId,
          processorName: processors.name,
          shipDate: shipments.shipDate,
          driverId: shipments.driverId,
          driverName: drivers.name,
          truckId: shipments.truckId,
          truckPlate: trucks.plate,
          shippedKg: shipments.shippedKg,
          status: shipments.status,
          notes: shipments.notes,
        })
        .from(shipments)
        .innerJoin(processors, eq(shipments.processorId, processors.id))
        .leftJoin(drivers, and(eq(shipments.driverId, drivers.id), eq(drivers.tenantId, req.tenantId!)))
        .leftJoin(trucks, and(eq(shipments.truckId, trucks.id), eq(trucks.tenantId, req.tenantId!)))
        .where(and(eq(shipments.lotId, id), eq(shipments.tenantId, req.tenantId!)));

      const receipts = await db
        .select()
        .from(bulkReceipts)
        .where(and(eq(bulkReceipts.lotId, id), eq(bulkReceipts.tenantId, req.tenantId!)))
        .orderBy(desc(bulkReceipts.receiptDate));

      const totalInputKg = inputs.reduce((s, i) => s + parseFloat(i.netKg), 0);
      const totalShippedKg = lotShipments.reduce((s, sh) => s + (sh.shippedKg ? parseFloat(sh.shippedKg) : 0), 0);
      const totalReceivedKg = receipts.reduce((s, r) => s + parseFloat(r.totalKg), 0);

      res.json({
        ...lot,
        inputs,
        shipments: lotShipments,
        receipts,
        totalInputKg,
        totalShippedKg,
        totalReceivedKg,
      });
    } catch (err) {
      console.error('Lot get error:', err);
      res.status(500).json({ error: 'Error al obtener lote' });
    }
  }
);

/**
 * GET /api/lots/:id/yield
 * Rendimiento y liquidación por lote
 */
router.get(
  '/:id/yield',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const lotId = req.params.id;

    try {
      const [lot] = await db
        .select({ id: lots.id, code: lots.code, status: lots.status, createdAt: lots.createdAt })
        .from(lots)
        .where(and(eq(lots.id, lotId), eq(lots.tenantId, req.tenantId)))
        .limit(1);

      if (!lot) {
        res.status(404).json({ error: 'Lote no encontrado' });
        return;
      }

      const inputRows = await db
        .select({ netKg: lotInputs.netKg })
        .from(lotInputs)
        .where(and(eq(lotInputs.lotId, lotId), eq(lotInputs.tenantId, req.tenantId)));
      const inputKg = inputRows.reduce((s, r) => s + parseFloat(r.netKg), 0);

      const receipts = await db
        .select()
        .from(bulkReceipts)
        .where(and(eq(bulkReceipts.lotId, lotId), eq(bulkReceipts.tenantId, req.tenantId)))
        .orderBy(desc(bulkReceipts.receiptDate));

      const shippedRows = await db
        .select({ shippedKg: shipments.shippedKg })
        .from(shipments)
        .where(and(eq(shipments.lotId, lotId), eq(shipments.tenantId, req.tenantId)));
      const shippedKg = shippedRows.reduce((s, r) => s + (r.shippedKg ? parseFloat(r.shippedKg) : 0), 0);

      const receivedKg = receipts.reduce((s, r) => s + parseFloat(r.totalKg), 0);

      const receiptIds = receipts.map((r) => r.id);
      let splitSumByReceipt: Record<string, number> = {};
      let breakdownByItem: Array<{ itemId: string; itemName: string; category: string; qtyKg: number }> = [];
      let finishedKg = 0;
      let subproductKg = 0;
      let otherKg = 0;

      if (receiptIds.length > 0) {
        const splits = await db
          .select({
            bulkReceiptId: bulkReceiptSplits.bulkReceiptId,
            itemId: bulkReceiptSplits.itemId,
            itemName: items.name,
            category: items.category,
            qtyKg: bulkReceiptSplits.qtyKg,
          })
          .from(bulkReceiptSplits)
          .innerJoin(items, eq(bulkReceiptSplits.itemId, items.id))
          .where(
            and(
              eq(bulkReceiptSplits.tenantId, req.tenantId),
              inArray(bulkReceiptSplits.bulkReceiptId, receiptIds)
            )
          );

        for (const r of receiptIds) {
          splitSumByReceipt[r] = 0;
        }
        const itemMap: Record<string, { itemName: string; category: string; qtyKg: number }> = {};
        for (const s of splits) {
          splitSumByReceipt[s.bulkReceiptId] = (splitSumByReceipt[s.bulkReceiptId] ?? 0) + parseFloat(s.qtyKg);
          const qty = parseFloat(s.qtyKg);
          if (s.category === 'FINISHED') finishedKg += qty;
          else if (s.category === 'SUBPRODUCT') subproductKg += qty;
          else otherKg += qty;
          if (!itemMap[s.itemId]) {
            itemMap[s.itemId] = { itemName: s.itemName ?? '?', category: s.category, qtyKg: 0 };
          }
          itemMap[s.itemId].qtyKg += qty;
        }
        breakdownByItem = Object.entries(itemMap).map(([itemId, v]) => ({
          itemId,
          itemName: v.itemName,
          category: v.category,
          qtyKg: v.qtyKg,
        }));
      }

      const splitKg = finishedKg + subproductKg + otherKg;
      const isSplitComplete = receivedKg <= 0 || Math.abs(splitKg - receivedKg) < 0.001;
      const missingSplitKg = Math.max(0, receivedKg - splitKg);

      const receiptsWithSplit = receipts.map((r) => {
        const totalKg = parseFloat(r.totalKg);
        const splitSumKg = splitSumByReceipt[r.id] ?? 0;
        const pendingKg = Math.max(0, totalKg - splitSumKg);
        return {
          id: r.id,
          receiptDate: r.receiptDate,
          totalKg,
          superSacksCount: r.superSacksCount,
          splitSumKg,
          pendingKg,
        };
      });

      const yieldPct = inputKg > 0 ? (receivedKg / inputKg) * 100 : null;
      const lossKg = inputKg - receivedKg;

      res.json({
        lot: { id: lot.id, code: lot.code, status: lot.status, createdAt: lot.createdAt },
        inputKg,
        receivedKg,
        shippedKg,
        yieldPct,
        lossKg,
        receipts: receiptsWithSplit,
        breakdownByCategory: { finishedKg, subproductKg, otherKg },
        breakdownByItem,
        flags: {
          isSplitComplete,
          missingSplitKg,
        },
      });
    } catch (err) {
      console.error('Lot yield error:', err);
      res.status(500).json({ error: 'Error al obtener rendimiento' });
    }
  }
);

/**
 * PUT /api/lots/:id
 */
router.put(
  '/:id',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const id = req.params.id;
    const parsed = updateLotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [existing] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), eq(lots.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Lote no encontrado' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.code !== undefined) updates.code = parsed.data.code;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    const [updated] = await db
      .update(lots)
      .set(updates as Record<string, string | Date | null>)
      .where(eq(lots.id, id))
      .returning();

    res.json(updated);
  }
);

/**
 * DELETE /api/lots/:id
 */
router.delete(
  '/:id',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const id = req.params.id;

    const [existing] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), eq(lots.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Lote no encontrado' });
      return;
    }

    const [hasInputs] = await db
      .select({ id: lotInputs.id })
      .from(lotInputs)
      .where(eq(lotInputs.lotId, id))
      .limit(1);

    const [hasShipments] = await db
      .select({ id: shipments.id })
      .from(shipments)
      .where(eq(shipments.lotId, id))
      .limit(1);

    const [hasReceipts] = await db
      .select({ id: bulkReceipts.id })
      .from(bulkReceipts)
      .where(eq(bulkReceipts.lotId, id))
      .limit(1);

    if (hasInputs || hasShipments || hasReceipts) {
      res.status(400).json({ error: 'No se puede eliminar: el lote tiene movimientos' });
      return;
    }

    await db.delete(lots).where(eq(lots.id, id));
    res.status(204).send();
  }
);

/**
 * GET /api/lots/:id/available-weigh-tickets
 * Pesadas no asignadas a ningún lote
 */
router.get(
  '/:id/available-weigh-tickets',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const lotId = req.params.id;

    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, lotId), eq(lots.tenantId, req.tenantId!)))
      .limit(1);

    if (!lot) {
      res.status(404).json({ error: 'Lote no encontrado' });
      return;
    }

    const assignedIds = await db
      .select({ weighTicketId: lotInputs.weighTicketId })
      .from(lotInputs)
      .where(eq(lotInputs.tenantId, req.tenantId!));

    const assignedSet = new Set(assignedIds.map((r) => r.weighTicketId));

    const allTickets = await db
      .select({
        id: weighTickets.id,
        ticketNumber: weighTickets.ticketNumber,
        datetime: weighTickets.datetime,
        type: weighTickets.type,
        netKg: weighTickets.netKg,
        supplierName: suppliers.name,
      })
      .from(weighTickets)
      .leftJoin(suppliers, and(eq(weighTickets.supplierId, suppliers.id), eq(suppliers.tenantId, req.tenantId!)))
      .where(eq(weighTickets.tenantId, req.tenantId!))
      .orderBy(desc(weighTickets.datetime))
      .limit(200);

    const available = allTickets.filter((t) => !assignedSet.has(t.id));

    res.json(available);
  }
);

/**
 * POST /api/lots/:id/inputs
 */
router.post(
  '/:id/inputs',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const lotId = req.params.id;
    const parsed = addInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, lotId), eq(lots.tenantId, req.tenantId!)))
      .limit(1);

    if (!lot) {
      res.status(404).json({ error: 'Lote no encontrado' });
      return;
    }

    const [weighTicket] = await db
      .select()
      .from(weighTickets)
      .where(and(eq(weighTickets.id, parsed.data.weighTicketId), eq(weighTickets.tenantId, req.tenantId!)))
      .limit(1);

    if (!weighTicket) {
      res.status(404).json({ error: 'Pesada no encontrada' });
      return;
    }

    const [alreadyInLot] = await db
      .select({ id: lotInputs.id })
      .from(lotInputs)
      .where(eq(lotInputs.weighTicketId, parsed.data.weighTicketId))
      .limit(1);

    if (alreadyInLot) {
      res.status(400).json({ error: 'La pesada ya está asignada a otro lote' });
      return;
    }

    const netKg = parseFloat(weighTicket.netKg);

    try {
      const [inserted] = await db
        .insert(lotInputs)
        .values({
          tenantId: req.tenantId,
          lotId,
          weighTicketId: parsed.data.weighTicketId,
          netKg: String(netKg),
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Lot input create error:', err);
      res.status(500).json({ error: 'Error al agregar pesada' });
    }
  }
);

/**
 * DELETE /api/lots/:id/inputs/:inputId
 */
router.delete(
  '/:id/inputs/:inputId',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const { id: lotId, inputId } = req.params;

    const [deleted] = await db
      .delete(lotInputs)
      .where(
        and(
          eq(lotInputs.id, inputId),
          eq(lotInputs.lotId, lotId),
          eq(lotInputs.tenantId, req.tenantId!)
        )
      )
      .returning({ id: lotInputs.id });

    if (!deleted) {
      res.status(404).json({ error: 'Entrada no encontrada' });
      return;
    }

    res.status(204).send();
  }
);

/**
 * POST /api/lots/:id/shipments
 */
router.post(
  '/:id/shipments',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const lotId = req.params.id;
    const parsed = createShipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, lotId), eq(lots.tenantId, req.tenantId!)))
      .limit(1);

    if (!lot) {
      res.status(404).json({ error: 'Lote no encontrado' });
      return;
    }

    try {
      const [inserted] = await db
        .insert(shipments)
        .values({
          tenantId: req.tenantId,
          lotId,
          processorId: parsed.data.processorId,
          shipDate: parsed.data.shipDate ? new Date(parsed.data.shipDate) : null,
          driverId: parsed.data.driverId ?? null,
          truckId: parsed.data.truckId ?? null,
          shippedKg: parsed.data.shippedKg != null ? String(parsed.data.shippedKg) : null,
          status: parsed.data.status ?? 'CREATED',
          notes: parsed.data.notes ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Shipment create error:', err);
      res.status(500).json({ error: 'Error al crear envío' });
    }
  }
);

/**
 * PUT /api/lots/:id/shipments/:shipmentId
 */
router.put(
  '/:id/shipments/:shipmentId',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const { id: lotId, shipmentId } = req.params;
    const parsed = updateShipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [existing] = await db
      .select()
      .from(shipments)
      .where(
        and(
          eq(shipments.id, shipmentId),
          eq(shipments.lotId, lotId),
          eq(shipments.tenantId, req.tenantId!)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Envío no encontrado' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.processorId !== undefined) updates.processorId = parsed.data.processorId;
    if (parsed.data.shipDate !== undefined) updates.shipDate = parsed.data.shipDate ? new Date(parsed.data.shipDate) : null;
    if (parsed.data.driverId !== undefined) updates.driverId = parsed.data.driverId ?? null;
    if (parsed.data.truckId !== undefined) updates.truckId = parsed.data.truckId ?? null;
    if (parsed.data.shippedKg !== undefined) updates.shippedKg = parsed.data.shippedKg != null ? String(parsed.data.shippedKg) : null;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes ?? null;

    const [updated] = await db
      .update(shipments)
      .set(updates as Record<string, string | Date | null>)
      .where(eq(shipments.id, shipmentId))
      .returning();

    res.json(updated);
  }
);

/**
 * POST /api/lots/:id/receipts
 */
router.post(
  '/:id/receipts',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const lotId = req.params.id;
    const parsed = createReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, lotId), eq(lots.tenantId, req.tenantId!)))
      .limit(1);

    if (!lot) {
      res.status(404).json({ error: 'Lote no encontrado' });
      return;
    }

    try {
      const [inserted] = await db
        .insert(bulkReceipts)
        .values({
          tenantId: req.tenantId,
          lotId,
          receiptDate: new Date(parsed.data.receiptDate),
          superSacksCount: parsed.data.superSacksCount ?? 0,
          totalKg: String(parsed.data.totalKg),
          notes: parsed.data.notes ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Receipt create error:', err);
      res.status(500).json({ error: 'Error al registrar recepción' });
    }
  }
);

/**
 * PUT /api/lots/:id/receipts/:receiptId
 */
router.put(
  '/:id/receipts/:receiptId',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const { id: lotId, receiptId } = req.params;
    const parsed = updateReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const [existing] = await db
      .select()
      .from(bulkReceipts)
      .where(
        and(
          eq(bulkReceipts.id, receiptId),
          eq(bulkReceipts.lotId, lotId),
          eq(bulkReceipts.tenantId, req.tenantId!)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Recepción no encontrada' });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.receiptDate !== undefined) updates.receiptDate = new Date(parsed.data.receiptDate);
    if (parsed.data.superSacksCount !== undefined) updates.superSacksCount = parsed.data.superSacksCount;
    if (parsed.data.totalKg !== undefined) updates.totalKg = String(parsed.data.totalKg);
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes ?? null;

    const [updated] = await db
      .update(bulkReceipts)
      .set(updates as Record<string, string | number | Date | null>)
      .where(eq(bulkReceipts.id, receiptId))
      .returning();

    res.json(updated);
  }
);

/**
 * DELETE /api/lots/:id/receipts/:receiptId
 */
router.delete(
  '/:id/receipts/:receiptId',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    const { id: lotId, receiptId } = req.params;

    const [deleted] = await db
      .delete(bulkReceipts)
      .where(
        and(
          eq(bulkReceipts.id, receiptId),
          eq(bulkReceipts.lotId, lotId),
          eq(bulkReceipts.tenantId, req.tenantId!)
        )
      )
      .returning({ id: bulkReceipts.id });

    if (!deleted) {
      res.status(404).json({ error: 'Recepción no encontrada' });
      return;
    }

    res.status(204).send();
  }
);

export default router;
