import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  bulkReceipts,
  bulkReceiptSplits,
  items,
  inventoryMoves,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'OperadorPesada', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const splitsSchema = z.object({
  splits: z.array(
    z.object({
      itemId: z.string().uuid(),
      qtyKg: z.number().min(0),
    })
  ),
});

/**
 * GET /api/bulk-receipts/:id/splits
 */
router.get(
  '/:id/splits',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const receiptId = req.params.id;

    try {
      const [receipt] = await db
        .select()
        .from(bulkReceipts)
        .where(and(eq(bulkReceipts.id, receiptId), eq(bulkReceipts.tenantId, req.tenantId)));

      if (!receipt) {
        res.status(404).json({ error: 'Recepción no encontrada' });
        return;
      }

      const splits = await db
        .select({
          id: bulkReceiptSplits.id,
          itemId: bulkReceiptSplits.itemId,
          itemName: items.name,
          qtyKg: bulkReceiptSplits.qtyKg,
        })
        .from(bulkReceiptSplits)
        .leftJoin(items, eq(bulkReceiptSplits.itemId, items.id))
        .where(and(eq(bulkReceiptSplits.bulkReceiptId, receiptId), eq(bulkReceiptSplits.tenantId, req.tenantId)));

      res.json({
        receiptId,
        totalKg: parseFloat(receipt.totalKg),
        splits: splits.map((s) => ({
          id: s.id,
          itemId: s.itemId,
          itemName: s.itemName ?? '?',
          qtyKg: parseFloat(s.qtyKg),
        })),
      });
    } catch (err) {
      console.error('Bulk receipt splits get error:', err);
      res.status(500).json({ error: 'Error al obtener splits' });
    }
  }
);

/**
 * POST /api/bulk-receipts/:id/splits
 * PUT /api/bulk-receipts/:id/splits (mismo body, upsert idempotente)
 * body: { splits: [{ itemId, qtyKg }, ...] }
 * Validar: suma <= total_kg (o ==, permitimos <= con warning implícito)
 * Idempotencia: borrar movimientos previos para este receipt y recrear
 */
async function upsertSplits(req: Request, res: Response) {
  if (!req.tenantId) {
    res.status(403).json({ error: 'Contexto de tenant no disponible' });
    return;
  }
  if (!canWrite(req.user?.role ?? '')) {
    res.status(403).json({ error: 'Sin permiso para editar splits' });
    return;
  }

  const tenantId = req.tenantId;
  const userId = req.user?.id ?? null;
  const receiptId = req.params.id;
  const parsed = splitsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
    return;
  }

  const { splits } = parsed.data;
  if (splits.length === 0) {
    res.status(400).json({ error: 'Debe incluir al menos un split' });
    return;
  }

  try {
    const [receipt] = await db
      .select()
      .from(bulkReceipts)
      .where(and(eq(bulkReceipts.id, receiptId), eq(bulkReceipts.tenantId, tenantId)));

    if (!receipt) {
      res.status(404).json({ error: 'Recepción no encontrada' });
      return;
    }

    const totalKg = parseFloat(receipt.totalKg);
    const sumSplits = splits.reduce((acc, s) => acc + s.qtyKg, 0);
    if (sumSplits > totalKg) {
      res.status(400).json({ error: `La suma de splits (${sumSplits}) no puede superar el total de la recepción (${totalKg})` });
      return;
    }

    const itemIds = [...new Set(splits.map((s) => s.itemId))];
    const itemsList = await db
      .select()
      .from(items)
      .where(and(eq(items.tenantId, tenantId), eq(items.isActive, true)));
    const itemIdsValid = new Set(itemsList.map((i) => i.id));
    for (const id of itemIds) {
      if (!itemIdsValid.has(id)) {
        res.status(400).json({ error: `Item ${id} no encontrado o no pertenece al tenant` });
        return;
      }
    }

    await db.transaction(async (tx) => {
      const movesFromReceipt = await tx
        .select()
        .from(inventoryMoves)
        .where(
          and(
            eq(inventoryMoves.tenantId, tenantId),
            eq(inventoryMoves.refType, 'BULK_RECEIPT'),
            eq(inventoryMoves.refId, receiptId)
          )
        );

      for (const move of movesFromReceipt) {
        await tx.delete(inventoryMoves).where(eq(inventoryMoves.id, move.id));
      }

      await tx.delete(bulkReceiptSplits).where(
        and(eq(bulkReceiptSplits.bulkReceiptId, receiptId), eq(bulkReceiptSplits.tenantId, tenantId))
      );

      const receiptDate = receipt.receiptDate;

      for (const s of splits) {
        if (s.qtyKg <= 0) continue;
        await tx.insert(bulkReceiptSplits).values({
          tenantId,
          bulkReceiptId: receiptId,
          itemId: s.itemId,
          qtyKg: String(s.qtyKg),
        });
        await tx.insert(inventoryMoves).values({
          tenantId,
          itemId: s.itemId,
          datetime: receiptDate,
          direction: 'IN',
          qtyKg: String(s.qtyKg),
          refType: 'BULK_RECEIPT',
          refId: receiptId,
          notes: null,
          createdBy: userId,
        });
      }
    });

    const updated = await db
      .select({
        id: bulkReceiptSplits.id,
        itemId: bulkReceiptSplits.itemId,
        itemName: items.name,
        qtyKg: bulkReceiptSplits.qtyKg,
      })
      .from(bulkReceiptSplits)
      .leftJoin(items, eq(bulkReceiptSplits.itemId, items.id))
      .where(and(eq(bulkReceiptSplits.bulkReceiptId, receiptId), eq(bulkReceiptSplits.tenantId, tenantId)));

    res.status(200).json({
      receiptId,
      totalKg,
      splits: updated.map((s) => ({
        id: s.id,
        itemId: s.itemId,
        itemName: s.itemName ?? '?',
        qtyKg: parseFloat(s.qtyKg),
      })),
    });
  } catch (err) {
    console.error('Bulk receipt splits upsert error:', err);
    res.status(500).json({ error: 'Error al guardar splits' });
  }
}

router.post('/:id/splits', authMiddleware, tenantContextMiddleware, requireTenantMiddleware, upsertSplits);
router.put('/:id/splits', authMiddleware, tenantContextMiddleware, requireTenantMiddleware, upsertSplits);

export default router;
