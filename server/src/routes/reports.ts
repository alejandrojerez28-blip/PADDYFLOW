import { Router } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db/index.js';
import { salesDocuments } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
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
      let query = db
        .select()
        .from(salesDocuments)
        .where(eq(salesDocuments.tenantId, req.tenantId))
        .orderBy(desc(salesDocuments.issueDate));

      const docs = await query;

      let filtered = docs;
      if (from) {
        filtered = filtered.filter((d) => d.issueDate && d.issueDate >= from);
      }
      if (to) {
        filtered = filtered.filter((d) => d.issueDate && d.issueDate <= to);
      }

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

      for (const d of filtered) {
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
 * GET /api/reports/documents/export?format=xlsx
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

    try {
      const docs = await db
        .select()
        .from(salesDocuments)
        .where(eq(salesDocuments.tenantId, req.tenantId))
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

export default router;
