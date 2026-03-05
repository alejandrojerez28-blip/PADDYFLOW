import { Router } from 'express';
import { db } from '../db/index.js';
import {
  suppliers,
  drivers,
  trucks,
  weighTickets,
  lots,
  lotInputs,
  bulkReceipts,
  bulkReceiptSplits,
} from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

/**
 * GET /api/onboarding/status
 * Conteos y flags para checklist de onboarding
 */
router.get(
  '/status',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const tenantId = req.tenantId;

    try {
      const [suppliersCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(suppliers)
        .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.isActive, true)));

      const [driversCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(drivers)
        .where(and(eq(drivers.tenantId, tenantId), eq(drivers.isActive, true)));

      const [trucksCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(trucks)
        .where(and(eq(trucks.tenantId, tenantId), eq(trucks.isActive, true)));

      const [weighTicketsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(weighTickets)
        .where(eq(weighTickets.tenantId, tenantId));

      const [lotsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(lots)
        .where(eq(lots.tenantId, tenantId));

      const lotsWithInputs = await db
        .selectDistinct({ lotId: lotInputs.lotId })
        .from(lotInputs)
        .where(eq(lotInputs.tenantId, tenantId));
      const lotsWithInputsSet = new Set(lotsWithInputs.map((r) => r.lotId));

      const lotsWithReceipts = await db
        .selectDistinct({ lotId: bulkReceipts.lotId })
        .from(bulkReceipts)
        .where(eq(bulkReceipts.tenantId, tenantId));
      const lotsWithReceiptsSet = new Set(lotsWithReceipts.map((r) => r.lotId));

      const allLots = await db
        .select({ id: lots.id, status: lots.status })
        .from(lots)
        .where(eq(lots.tenantId, tenantId));

      let firstLotIdWithoutInputs: string | null = null;
      let firstLotIdWithoutReceipts: string | null = null;
      for (const lot of allLots) {
        if (!lotsWithInputsSet.has(lot.id) && lot.status === 'OPEN' && !firstLotIdWithoutInputs) {
          firstLotIdWithoutInputs = lot.id;
        }
        if (!lotsWithReceiptsSet.has(lot.id) && !firstLotIdWithoutReceipts) {
          firstLotIdWithoutReceipts = lot.id;
        }
      }

      const receipts = await db
        .select({ id: bulkReceipts.id, lotId: bulkReceipts.lotId, totalKg: bulkReceipts.totalKg })
        .from(bulkReceipts)
        .where(eq(bulkReceipts.tenantId, tenantId));

      const splitsByReceipt = await db
        .select({
          bulkReceiptId: bulkReceiptSplits.bulkReceiptId,
          qtyKg: bulkReceiptSplits.qtyKg,
        })
        .from(bulkReceiptSplits)
        .where(eq(bulkReceiptSplits.tenantId, tenantId));

      const splitSumByReceipt: Record<string, number> = {};
      for (const s of splitsByReceipt) {
        splitSumByReceipt[s.bulkReceiptId] = (splitSumByReceipt[s.bulkReceiptId] ?? 0) + parseFloat(s.qtyKg);
      }

      let hasReceiptWithPendingSplit = false;
      let firstLotIdWithReceiptPendingSplit: string | null = null;
      for (const r of receipts) {
        const totalKg = parseFloat(r.totalKg);
        const splitSum = splitSumByReceipt[r.id] ?? 0;
        if (splitSum < totalKg - 0.001) {
          hasReceiptWithPendingSplit = true;
          if (!firstLotIdWithReceiptPendingSplit) firstLotIdWithReceiptPendingSplit = r.lotId;
        }
      }

      const hasLotWithoutInputs = allLots.some((l) => !lotsWithInputsSet.has(l.id));
      const hasLotWithoutReceipts = allLots.some((l) => !lotsWithReceiptsSet.has(l.id));

      res.json({
        suppliersCount: suppliersCount?.count ?? 0,
        driversCount: driversCount?.count ?? 0,
        trucksCount: trucksCount?.count ?? 0,
        weighTicketsCount: weighTicketsCount?.count ?? 0,
        lotsCount: lotsCount?.count ?? 0,
        hasLotWithoutInputs,
        hasLotWithoutReceipts,
        hasReceiptWithPendingSplit,
        firstLotIdWithoutInputs,
        firstLotIdWithoutReceipts,
        firstLotIdWithReceiptPendingSplit,
      });
    } catch (err) {
      console.error('Onboarding status error:', err);
      res.status(500).json({ error: 'Error al obtener estado de onboarding' });
    }
  }
);

export default router;
