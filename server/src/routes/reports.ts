import { Router } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db/index.js';
import {
  salesDocuments,
  weighTickets,
  suppliers,
  drivers,
  trucks,
  items,
  inventoryMoves,
  lots,
  lotInputs,
  bulkReceipts,
  bulkReceiptSplits,
  shipments,
} from '../db/schema.js';
import { eq, desc, and, gte, lte, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

/**
 * GET /api/reports/sales/export?format=xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get(
  '/sales/export',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const format = req.query.format as string;
    if (format !== 'xlsx') {
      res.status(400).json({ error: 'Formato no soportado. Use format=xlsx' });
      return;
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    try {
      const conditions = [eq(salesDocuments.tenantId, req.tenantId)];
      if (from) conditions.push(gte(salesDocuments.issueDate, from));
      if (to) conditions.push(lte(salesDocuments.issueDate, to));

      const docs = await db
        .select()
        .from(salesDocuments)
        .where(and(...conditions))
        .orderBy(desc(salesDocuments.issueDate));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PaddyFlow';
      const sheet = workbook.addWorksheet('Ventas', { headerFooter: { firstHeader: 'Reporte de Ventas' } });

      sheet.columns = [
        { header: 'Fecha', key: 'issueDate', width: 12 },
        { header: 'Tipo', key: 'kind', width: 16 },
        { header: 'Número', key: 'number', width: 20 },
        { header: 'Moneda', key: 'currency', width: 6 },
        { header: 'Subtotal', key: 'subtotal', width: 12 },
        { header: 'ITBIS', key: 'itbis', width: 12 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Estado', key: 'status', width: 10 },
      ];

      sheet.getRow(1).font = { bold: true };

      for (const d of docs) {
        const number = d.ncfOrEcfNumber ?? d.internalNumber ?? d.id.slice(0, 8);
        sheet.addRow({
          issueDate: d.issueDate ?? '',
          kind: d.kind,
          number,
          currency: d.currency,
          subtotal: parseFloat(d.subtotal),
          itbis: parseFloat(d.itbis),
          total: parseFloat(d.total),
          status: d.status,
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `ventas_${req.tenantId.slice(0, 8)}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
    } catch (err) {
      console.error('Sales export error:', err);
      res.status(500).json({ error: 'Error al exportar' });
    }
  }
);

/**
 * GET /api/reports/documents/export?format=xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Export genérico de documentos (proformas + facturas)
 */
router.get(
  '/documents/export',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const format = req.query.format as string;
    if (format !== 'xlsx') {
      res.status(400).json({ error: 'Formato no soportado. Use format=xlsx' });
      return;
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    try {
      const conditions = [eq(salesDocuments.tenantId, req.tenantId)];
      if (from) conditions.push(gte(salesDocuments.issueDate, from));
      if (to) conditions.push(lte(salesDocuments.issueDate, to));

      const docs = await db
        .select()
        .from(salesDocuments)
        .where(and(...conditions))
        .orderBy(desc(salesDocuments.createdAt));

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Documentos');

      sheet.columns = [
        { header: 'Fecha', key: 'issueDate', width: 12 },
        { header: 'Tipo', key: 'kind', width: 16 },
        { header: 'Número', key: 'number', width: 24 },
        { header: 'Moneda', key: 'currency', width: 6 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Estado', key: 'status', width: 10 },
      ];

      sheet.getRow(1).font = { bold: true };

      for (const d of docs) {
        const number = d.ncfOrEcfNumber ?? d.internalNumber ?? d.id.slice(0, 8);
        sheet.addRow({
          issueDate: d.issueDate ?? '',
          kind: d.kind,
          number,
          currency: d.currency,
          total: parseFloat(d.total),
          status: d.status,
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `documentos_${req.tenantId.slice(0, 8)}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
    } catch (err) {
      console.error('Documents export error:', err);
      res.status(500).json({ error: 'Error al exportar' });
    }
  }
);

/**
 * GET /api/reports/weigh-tickets/export?format=xlsx&dateFrom=&dateTo=&type=&supplierId=&driverId=
 */
router.get(
  '/weigh-tickets/export',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const format = req.query.format as string;
    if (format !== 'xlsx') {
      res.status(400).json({ error: 'Formato no soportado. Use format=xlsx' });
      return;
    }

    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const type = req.query.type as string | undefined;
    const supplierId = req.query.supplierId as string | undefined;
    const driverId = req.query.driverId as string | undefined;
    const truckId = req.query.truckId as string | undefined;

    try {
      const conditions = [eq(weighTickets.tenantId, req.tenantId)];
      if (dateFrom) {
        conditions.push(gte(weighTickets.datetime, new Date(dateFrom + 'T00:00:00Z')));
      }
      if (dateTo) {
        conditions.push(lte(weighTickets.datetime, new Date(dateTo + 'T23:59:59.999Z')));
      }
      if (type && ['PADDY', 'SUBPRODUCT', 'OTHER'].includes(type)) {
        conditions.push(eq(weighTickets.type, type as 'PADDY' | 'SUBPRODUCT' | 'OTHER'));
      }
      if (supplierId) conditions.push(eq(weighTickets.supplierId, supplierId));
      if (driverId) conditions.push(eq(weighTickets.driverId, driverId));
      if (truckId) conditions.push(eq(weighTickets.truckId, truckId));

      const rows = await db
        .select({
          datetime: weighTickets.datetime,
          type: weighTickets.type,
          grossKg: weighTickets.grossKg,
          tareKg: weighTickets.tareKg,
          netKg: weighTickets.netKg,
          notes: weighTickets.notes,
          supplierName: suppliers.name,
          driverName: drivers.name,
          truckPlate: trucks.plate,
        })
        .from(weighTickets)
        .leftJoin(suppliers, and(eq(weighTickets.supplierId, suppliers.id), eq(suppliers.tenantId, req.tenantId!)))
        .leftJoin(drivers, and(eq(weighTickets.driverId, drivers.id), eq(drivers.tenantId, req.tenantId!)))
        .leftJoin(trucks, and(eq(weighTickets.truckId, trucks.id), eq(trucks.tenantId, req.tenantId!)))
        .where(and(...conditions))
        .orderBy(desc(weighTickets.datetime));

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Pesadas');

      sheet.columns = [
        { header: 'DateTime', key: 'datetime', width: 20 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'GrossKg', key: 'grossKg', width: 12 },
        { header: 'TareKg', key: 'tareKg', width: 12 },
        { header: 'NetKg', key: 'netKg', width: 12 },
        { header: 'Supplier', key: 'supplier', width: 20 },
        { header: 'Driver', key: 'driver', width: 20 },
        { header: 'Truck', key: 'truck', width: 20 },
        { header: 'Notes', key: 'notes', width: 30 },
      ];

      sheet.getRow(1).font = { bold: true };

      for (const row of rows) {
        sheet.addRow({
          datetime: row.datetime instanceof Date ? row.datetime.toISOString() : String(row.datetime),
          type: row.type,
          grossKg: parseFloat(row.grossKg),
          tareKg: parseFloat(row.tareKg),
          netKg: parseFloat(row.netKg),
          supplier: row.supplierName ?? '',
          driver: row.driverName ?? '',
          truck: row.truckPlate ?? '',
          notes: row.notes ?? '',
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `pesadas_${req.tenantId.slice(0, 8)}_${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
    } catch (err) {
      console.error('Weigh tickets export error:', err);
      res.status(500).json({ error: 'Error al exportar pesadas' });
    }
  }
);

/**
 * GET /api/reports/inventory/stock/export?format=xlsx
 */
router.get(
  '/inventory/stock/export',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const format = req.query.format as string;
    if (format !== 'xlsx') {
      res.status(400).json({ error: 'Formato no soportado. Use format=xlsx' });
      return;
    }

    try {
      const allItems = await db
        .select({ id: items.id, name: items.name, sku: items.sku, category: items.category, uom: items.uom })
        .from(items)
        .where(and(eq(items.tenantId, req.tenantId), eq(items.isActive, true)));

      const moves = await db
        .select({ itemId: inventoryMoves.itemId, direction: inventoryMoves.direction, qtyKg: inventoryMoves.qtyKg })
        .from(inventoryMoves)
        .where(eq(inventoryMoves.tenantId, req.tenantId));

      const stockByItem: Record<string, number> = {};
      for (const item of allItems) stockByItem[item.id] = 0;
      for (const m of moves) {
        const qty = parseFloat(m.qtyKg);
        if (m.direction === 'IN') stockByItem[m.itemId] = (stockByItem[m.itemId] ?? 0) + qty;
        else if (m.direction === 'OUT') stockByItem[m.itemId] = (stockByItem[m.itemId] ?? 0) - qty;
        else stockByItem[m.itemId] = (stockByItem[m.itemId] ?? 0) + qty;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Stock');

      sheet.columns = [
        { header: 'Item', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Categoría', key: 'category', width: 14 },
        { header: 'UOM', key: 'uom', width: 8 },
        { header: 'Stock (kg)', key: 'stockKg', width: 14 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const item of allItems) {
        sheet.addRow({
          name: item.name,
          sku: item.sku ?? '',
          category: item.category,
          uom: item.uom,
          stockKg: stockByItem[item.id] ?? 0,
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="inventory_stock_${req.tenantId.slice(0, 8)}_${dateStr}.xlsx"`);
      await workbook.xlsx.write(res);
    } catch (err) {
      console.error('Inventory stock export error:', err);
      res.status(500).json({ error: 'Error al exportar stock' });
    }
  }
);

/**
 * GET /api/reports/inventory/moves/export?format=xlsx&from=&to=&itemId=
 */
router.get(
  '/inventory/moves/export',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const format = req.query.format as string;
    if (format !== 'xlsx') {
      res.status(400).json({ error: 'Formato no soportado. Use format=xlsx' });
      return;
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const itemId = req.query.itemId as string | undefined;

    try {
      const conditions = [eq(inventoryMoves.tenantId, req.tenantId)];
      if (from) conditions.push(gte(inventoryMoves.datetime, new Date(from + 'T00:00:00Z')));
      if (to) conditions.push(lte(inventoryMoves.datetime, new Date(to + 'T23:59:59.999Z')));
      if (itemId) conditions.push(eq(inventoryMoves.itemId, itemId));

      const rows = await db
        .select({
          datetime: inventoryMoves.datetime,
          itemName: items.name,
          direction: inventoryMoves.direction,
          qtyKg: inventoryMoves.qtyKg,
          refType: inventoryMoves.refType,
          notes: inventoryMoves.notes,
        })
        .from(inventoryMoves)
        .leftJoin(items, eq(inventoryMoves.itemId, items.id))
        .where(and(...conditions))
        .orderBy(desc(inventoryMoves.datetime))
        .limit(5000);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Movimientos');

      sheet.columns = [
        { header: 'Fecha', key: 'datetime', width: 20 },
        { header: 'Item', key: 'itemName', width: 30 },
        { header: 'Dirección', key: 'direction', width: 10 },
        { header: 'Cantidad (kg)', key: 'qtyKg', width: 14 },
        { header: 'Ref. Tipo', key: 'refType', width: 14 },
        { header: 'Notas', key: 'notes', width: 30 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const row of rows) {
        sheet.addRow({
          datetime: row.datetime instanceof Date ? row.datetime.toISOString() : String(row.datetime),
          itemName: row.itemName ?? '?',
          direction: row.direction,
          qtyKg: parseFloat(row.qtyKg),
          refType: row.refType,
          notes: row.notes ?? '',
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="inventory_moves_${req.tenantId.slice(0, 8)}_${dateStr}.xlsx"`);
      await workbook.xlsx.write(res);
    } catch (err) {
      console.error('Inventory moves export error:', err);
      res.status(500).json({ error: 'Error al exportar movimientos' });
    }
  }
);

/**
 * GET /api/reports/yield?from=&to=&processorId=&status=
 * Filtros: from/to por lots.createdAt, processorId (lots con envío a ese procesador), status del lote
 */
router.get(
  '/yield',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const processorId = req.query.processorId as string | undefined;
    const status = req.query.status as string | undefined;

    try {
      const conditions = [eq(lots.tenantId, req.tenantId)];
      if (from) conditions.push(gte(lots.createdAt, new Date(from + 'T00:00:00Z')));
      if (to) conditions.push(lte(lots.createdAt, new Date(to + 'T23:59:59.999Z')));
      if (status && ['OPEN', 'SENT', 'RECEIVED', 'CLOSED'].includes(status)) {
        conditions.push(eq(lots.status, status as 'OPEN' | 'SENT' | 'RECEIVED' | 'CLOSED'));
      }

      let lotIds: string[] = [];
      if (processorId) {
        const lotsWithProcessor = await db
          .selectDistinct({ lotId: shipments.lotId })
          .from(shipments)
          .where(and(eq(shipments.tenantId, req.tenantId), eq(shipments.processorId, processorId)));
        lotIds = lotsWithProcessor.map((r) => r.lotId).filter(Boolean) as string[];
        if (lotIds.length === 0) {
          res.json([]);
          return;
        }
        conditions.push(inArray(lots.id, lotIds));
      }

      const lotsList = await db
        .select({ id: lots.id, code: lots.code, status: lots.status, createdAt: lots.createdAt })
        .from(lots)
        .where(and(...conditions))
        .orderBy(desc(lots.createdAt))
        .limit(200);

      if (lotsList.length === 0) {
        res.json([]);
        return;
      }

      const ids = lotsList.map((l) => l.id);

      const inputs = await db
        .select({ lotId: lotInputs.lotId, netKg: lotInputs.netKg })
        .from(lotInputs)
        .where(and(eq(lotInputs.tenantId, req.tenantId), inArray(lotInputs.lotId, ids)));

      const receipts = await db
        .select({ lotId: bulkReceipts.lotId, id: bulkReceipts.id, totalKg: bulkReceipts.totalKg })
        .from(bulkReceipts)
        .where(and(eq(bulkReceipts.tenantId, req.tenantId), inArray(bulkReceipts.lotId, ids)));

      const receiptIds = receipts.map((r) => r.id);
      let splits: Array<{ bulkReceiptId: string; qtyKg: string }> = [];
      if (receiptIds.length > 0) {
        splits = await db
          .select({ bulkReceiptId: bulkReceiptSplits.bulkReceiptId, qtyKg: bulkReceiptSplits.qtyKg })
          .from(bulkReceiptSplits)
          .where(and(eq(bulkReceiptSplits.tenantId, req.tenantId), inArray(bulkReceiptSplits.bulkReceiptId, receiptIds)));
      }

      const receiptByLot: Record<string, typeof receipts> = {};
      for (const r of receipts) {
        if (!receiptByLot[r.lotId]) receiptByLot[r.lotId] = [];
        receiptByLot[r.lotId].push(r);
      }
      const receiptIdToLot: Record<string, string> = {};
      for (const r of receipts) receiptIdToLot[r.id] = r.lotId;

      const inputByLot: Record<string, number> = {};
      for (const i of inputs) {
        inputByLot[i.lotId] = (inputByLot[i.lotId] ?? 0) + parseFloat(i.netKg);
      }

      const splitByReceipt: Record<string, number> = {};
      for (const s of splits) {
        splitByReceipt[s.bulkReceiptId] = (splitByReceipt[s.bulkReceiptId] ?? 0) + parseFloat(s.qtyKg);
      }

      const result = lotsList.map((lot) => {
        const inputKg = inputByLot[lot.id] ?? 0;
        const lotReceipts = receiptByLot[lot.id] ?? [];
        const receivedKg = lotReceipts.reduce((a, r) => a + parseFloat(r.totalKg), 0);
        const splitKg = lotReceipts.reduce((a, r) => a + (splitByReceipt[r.id] ?? 0), 0);
        const yieldPct = inputKg > 0 ? (receivedKg / inputKg) * 100 : null;
        const lossKg = inputKg - receivedKg;
        const splitComplete = receivedKg <= 0 || Math.abs(splitKg - receivedKg) < 0.001;

        return {
          id: lot.id,
          code: lot.code,
          status: lot.status,
          createdAt: lot.createdAt,
          inputKg,
          receivedKg,
          yieldPct,
          lossKg,
          splitComplete,
        };
      });

      res.json(result);
    } catch (err) {
      console.error('Yield report error:', err);
      res.status(500).json({ error: 'Error al obtener reporte de rendimiento' });
    }
  }
);

/**
 * GET /api/reports/yield/export?format=xlsx&from=&to=
 * Hoja 1: Yield por lote. Hoja 2: Breakdown por item (lote, item, category, qtyKg)
 */
router.get(
  '/yield/export',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const format = req.query.format as string;
    if (format !== 'xlsx') {
      res.status(400).json({ error: 'Formato no soportado. Use format=xlsx' });
      return;
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const processorId = req.query.processorId as string | undefined;
    const status = req.query.status as string | undefined;

    try {
      const conditions = [eq(lots.tenantId, req.tenantId)];
      if (from) conditions.push(gte(lots.createdAt, new Date(from + 'T00:00:00Z')));
      if (to) conditions.push(lte(lots.createdAt, new Date(to + 'T23:59:59.999Z')));
      if (status && ['OPEN', 'SENT', 'RECEIVED', 'CLOSED'].includes(status)) {
        conditions.push(eq(lots.status, status as 'OPEN' | 'SENT' | 'RECEIVED' | 'CLOSED'));
      }

      let lotIds: string[] = [];
      if (processorId) {
        const lotsWithProcessor = await db
          .selectDistinct({ lotId: shipments.lotId })
          .from(shipments)
          .where(and(eq(shipments.tenantId, req.tenantId), eq(shipments.processorId, processorId)));
        lotIds = lotsWithProcessor.map((r) => r.lotId).filter(Boolean) as string[];
        if (lotIds.length === 0) {
          res.status(200);
          const workbook = new ExcelJS.Workbook();
          workbook.addWorksheet('Yield por lote');
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="yield_${req.tenantId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.xlsx"`);
          await workbook.xlsx.write(res);
          return;
        }
        conditions.push(inArray(lots.id, lotIds));
      }

      const lotsList = await db
        .select({ id: lots.id, code: lots.code, status: lots.status, createdAt: lots.createdAt })
        .from(lots)
        .where(and(...conditions))
        .orderBy(desc(lots.createdAt))
        .limit(500);

      const ids = lotsList.map((l) => l.id);
      const inputByLot: Record<string, number> = {};
      const receiptByLot: Record<string, Array<{ id: string; totalKg: string }>> = {};

      if (ids.length > 0) {
        const inputs = await db
          .select({ lotId: lotInputs.lotId, netKg: lotInputs.netKg })
          .from(lotInputs)
          .where(and(eq(lotInputs.tenantId, req.tenantId), inArray(lotInputs.lotId, ids)));
        for (const i of inputs) {
          inputByLot[i.lotId] = (inputByLot[i.lotId] ?? 0) + parseFloat(i.netKg);
        }

        const receipts = await db
          .select({ lotId: bulkReceipts.lotId, id: bulkReceipts.id, totalKg: bulkReceipts.totalKg })
          .from(bulkReceipts)
          .where(and(eq(bulkReceipts.tenantId, req.tenantId), inArray(bulkReceipts.lotId, ids)));
        for (const r of receipts) {
          if (!receiptByLot[r.lotId]) receiptByLot[r.lotId] = [];
          receiptByLot[r.lotId].push(r);
        }
      }

      const receiptIds = (Object.values(receiptByLot).flat()).map((r) => r.id);
      let breakdownRows: Array<{ lotCode: string; itemName: string; category: string; qtyKg: number }> = [];
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
          .where(and(eq(bulkReceiptSplits.tenantId, req.tenantId), inArray(bulkReceiptSplits.bulkReceiptId, receiptIds)));

        const receiptToLot: Record<string, string> = {};
        for (const l of lotsList) {
          for (const r of receiptByLot[l.id] ?? []) {
            receiptToLot[r.id] = l.code;
          }
        }
        const itemByLot: Record<string, Record<string, { name: string; category: string; qty: number }>> = {};
        for (const s of splits) {
          const lotCode = receiptToLot[s.bulkReceiptId] ?? '?';
          if (!itemByLot[lotCode]) itemByLot[lotCode] = {};
          const key = s.itemId;
          if (!itemByLot[lotCode][key]) {
            itemByLot[lotCode][key] = { name: s.itemName ?? '?', category: s.category, qty: 0 };
          }
          itemByLot[lotCode][key].qty += parseFloat(s.qtyKg);
        }
        for (const [lotCode, itemsMap] of Object.entries(itemByLot)) {
          for (const v of Object.values(itemsMap)) {
            breakdownRows.push({ lotCode, itemName: v.name, category: v.category, qtyKg: v.qty });
          }
        }
      }

      const splitByReceipt: Record<string, number> = {};
      if (receiptIds.length > 0) {
        const allSplits = await db
          .select({ bulkReceiptId: bulkReceiptSplits.bulkReceiptId, qtyKg: bulkReceiptSplits.qtyKg })
          .from(bulkReceiptSplits)
          .where(and(eq(bulkReceiptSplits.tenantId, req.tenantId), inArray(bulkReceiptSplits.bulkReceiptId, receiptIds)));
        for (const s of allSplits) {
          splitByReceipt[s.bulkReceiptId] = (splitByReceipt[s.bulkReceiptId] ?? 0) + parseFloat(s.qtyKg);
        }
      }

      const workbook = new ExcelJS.Workbook();
      const sheet1 = workbook.addWorksheet('Yield por lote');
      sheet1.columns = [
        { header: 'Lote', key: 'code', width: 16 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Fecha creación', key: 'createdAt', width: 18 },
        { header: 'Input (kg)', key: 'inputKg', width: 14 },
        { header: 'Recibido (kg)', key: 'receivedKg', width: 14 },
        { header: 'Yield %', key: 'yieldPct', width: 10 },
        { header: 'Merma (kg)', key: 'lossKg', width: 12 },
        { header: 'Split completo', key: 'splitComplete', width: 14 },
      ];
      sheet1.getRow(1).font = { bold: true };

      for (const lot of lotsList) {
        const inputKg = inputByLot[lot.id] ?? 0;
        const lotReceipts = receiptByLot[lot.id] ?? [];
        const receivedKg = lotReceipts.reduce((a, r) => a + parseFloat(r.totalKg), 0);
        const splitKg = lotReceipts.reduce((a, r) => a + (splitByReceipt[r.id] ?? 0), 0);
        const yieldPct = inputKg > 0 ? (receivedKg / inputKg) * 100 : null;
        const lossKg = inputKg - receivedKg;
        const splitComplete = receivedKg <= 0 || Math.abs(splitKg - receivedKg) < 0.001;

        sheet1.addRow({
          code: lot.code,
          status: lot.status,
          createdAt: lot.createdAt instanceof Date ? lot.createdAt.toISOString().slice(0, 10) : String(lot.createdAt),
          inputKg,
          receivedKg,
          yieldPct: yieldPct != null ? yieldPct.toFixed(2) : '',
          lossKg,
          splitComplete: splitComplete ? 'Sí' : 'No',
        });
      }

      const sheet2 = workbook.addWorksheet('Breakdown por item');
      sheet2.columns = [
        { header: 'Lote', key: 'lotCode', width: 16 },
        { header: 'Item', key: 'itemName', width: 30 },
        { header: 'Categoría', key: 'category', width: 14 },
        { header: 'Cantidad (kg)', key: 'qtyKg', width: 14 },
      ];
      sheet2.getRow(1).font = { bold: true };
      for (const row of breakdownRows) {
        sheet2.addRow(row);
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="yield_${req.tenantId.slice(0, 8)}_${dateStr}.xlsx"`);
      await workbook.xlsx.write(res);
    } catch (err) {
      console.error('Yield export error:', err);
      res.status(500).json({ error: 'Error al exportar rendimiento' });
    }
  }
);

export default router;
