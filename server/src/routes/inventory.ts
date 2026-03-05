import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { items, inventoryMoves } from '../db/schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'OperadorPesada', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const adjustmentSchema = z.object({
  itemId: z.string().uuid(),
  datetime: z.string().optional(),
  direction: z.enum(['IN', 'OUT', 'ADJUST']),
  qtyKg: z.number(),
  notes: z.string().max(1024).optional().nullable(),
});

/**
 * GET /api/inventory/stock
 * Retorna existencias actuales por item (SUM(IN) - SUM(OUT) +/- ADJUST)
 * ADJUST: positivo = suma (como IN), negativo = resta (como OUT)
 */
router.get(
  '/stock',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    try {
      const allItems = await db
        .select({ id: items.id, name: items.name, sku: items.sku, category: items.category, uom: items.uom })
        .from(items)
        .where(and(eq(items.tenantId, req.tenantId), eq(items.isActive, true)));

      const moves = await db
        .select({
          itemId: inventoryMoves.itemId,
          direction: inventoryMoves.direction,
          qtyKg: inventoryMoves.qtyKg,
        })
        .from(inventoryMoves)
        .where(eq(inventoryMoves.tenantId, req.tenantId));

      const stockByItem: Record<string, number> = {};
      for (const item of allItems) {
        stockByItem[item.id] = 0;
      }
      for (const m of moves) {
        const qty = parseFloat(m.qtyKg);
        if (m.direction === 'IN') {
          stockByItem[m.itemId] = (stockByItem[m.itemId] ?? 0) + qty;
        } else if (m.direction === 'OUT') {
          stockByItem[m.itemId] = (stockByItem[m.itemId] ?? 0) - qty;
        } else {
          stockByItem[m.itemId] = (stockByItem[m.itemId] ?? 0) + qty;
        }
      }

      const result = allItems.map((item) => ({
        ...item,
        stockKg: stockByItem[item.id] ?? 0,
      }));

      res.json(result);
    } catch (err) {
      console.error('Inventory stock error:', err);
      res.status(500).json({ error: 'Error al obtener stock' });
    }
  }
);

/**
 * GET /api/inventory/moves?itemId=&dateFrom=&dateTo=&refType=
 */
router.get(
  '/moves',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const itemId = req.query.itemId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const refType = req.query.refType as string | undefined;

    try {
      const conditions = [eq(inventoryMoves.tenantId, req.tenantId)];
      if (itemId) conditions.push(eq(inventoryMoves.itemId, itemId));
      if (dateFrom) {
        conditions.push(gte(inventoryMoves.datetime, new Date(dateFrom + 'T00:00:00Z')));
      }
      if (dateTo) {
        conditions.push(lte(inventoryMoves.datetime, new Date(dateTo + 'T23:59:59.999Z')));
      }
      if (refType && ['BULK_RECEIPT', 'SALE', 'PURCHASE', 'MANUAL'].includes(refType)) {
        conditions.push(eq(inventoryMoves.refType, refType as 'BULK_RECEIPT' | 'SALE' | 'PURCHASE' | 'MANUAL'));
      }

      const moves = await db
        .select({
          id: inventoryMoves.id,
          itemId: inventoryMoves.itemId,
          itemName: items.name,
          datetime: inventoryMoves.datetime,
          direction: inventoryMoves.direction,
          qtyKg: inventoryMoves.qtyKg,
          refType: inventoryMoves.refType,
          refId: inventoryMoves.refId,
          notes: inventoryMoves.notes,
        })
        .from(inventoryMoves)
        .leftJoin(items, eq(inventoryMoves.itemId, items.id))
        .where(and(...conditions))
        .orderBy(desc(inventoryMoves.datetime))
        .limit(500);

      res.json(moves.map((m) => ({ ...m, itemName: m.itemName ?? '?' })));
    } catch (err) {
      console.error('Inventory moves error:', err);
      res.status(500).json({ error: 'Error al listar movimientos' });
    }
  }
);

/**
 * POST /api/inventory/adjustments
 * Crea movimientos ADJUST (manual)
 */
router.post(
  '/adjustments',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para crear ajustes' });
      return;
    }

    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [item] = await db
        .select()
        .from(items)
        .where(and(eq(items.id, parsed.data.itemId), eq(items.tenantId, req.tenantId)));

      if (!item) {
        res.status(404).json({ error: 'Item no encontrado' });
        return;
      }

      const [inserted] = await db
        .insert(inventoryMoves)
        .values({
          tenantId: req.tenantId,
          itemId: parsed.data.itemId,
          datetime: parsed.data.datetime ? new Date(parsed.data.datetime) : new Date(),
          direction: 'ADJUST',
          qtyKg: String(parsed.data.qtyKg),
          refType: 'MANUAL',
          refId: null,
          notes: parsed.data.notes ?? null,
          createdBy: req.user?.id ?? null,
        })
        .returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error('Inventory adjustment error:', err);
      res.status(500).json({ error: 'Error al crear ajuste' });
    }
  }
);

export default router;
