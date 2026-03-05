import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  salesDocuments,
  salesDocumentItems,
  dgiiSequences,
  tenants,
  ecfTransmissions,
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';
import { requireFiscalReadyForWritesMiddleware } from '../middleware/requireFiscalReadyForWrites.js';
import { requireActiveSubscriptionMiddleware } from '../middleware/requireActiveSubscription.js';
import { getEcfAdapter } from '../ecf/EcfProviderRegistry.js';

const router = Router();

const itemSchema = z.object({
  itemName: z.string().min(1),
  sku: z.string().optional(),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  itbisRate: z.number().min(0).max(100).default(0),
});

const proformaSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  currency: z.enum(['DOP', 'USD']).default('DOP'),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
});

const fiscalInvoiceSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  docType: z
    .enum([
      'NCF_B01', 'NCF_B02', 'NCF_B14', 'NCF_B15',
      'ECF_E31', 'ECF_E32', 'ECF_E33', 'ECF_E34', 'ECF_E41', 'ECF_E43', 'ECF_E44', 'ECF_E45',
    ])
    .optional(),
  currency: z.enum(['DOP', 'USD']).default('DOP'),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
});

/**
 * GET /api/sales/documents
 * Listar documentos de venta (proformas + facturas)
 */
router.get(
  '/documents',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    try {
      const kind = req.query.kind as string | undefined;
      const docs = await db
        .select()
        .from(salesDocuments)
        .where(
          kind
            ? and(eq(salesDocuments.tenantId, req.tenantId), eq(salesDocuments.kind, kind as 'PROFORMA' | 'FISCAL_INVOICE'))
            : eq(salesDocuments.tenantId, req.tenantId)
        )
        .orderBy(desc(salesDocuments.createdAt))
        .limit(100);

      res.json(docs);
    } catch (err) {
      console.error('Sales documents list error:', err);
      res.status(500).json({ error: 'Error al listar documentos' });
    }
  }
);

/**
 * POST /api/sales/proformas
 * Crear proforma (permitido en BASIC onboarding)
 */
router.post(
  '/proformas',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  requireActiveSubscriptionMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const parsed = proformaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const { customerId, currency, items, notes } = parsed.data;

      const existingProformas = await db
        .select({ internalNumber: salesDocuments.internalNumber })
        .from(salesDocuments)
        .where(
          and(
            eq(salesDocuments.tenantId, req.tenantId),
            eq(salesDocuments.kind, 'PROFORMA')
          )
        );

      const maxNum = existingProformas.reduce((acc, d) => {
        const match = d.internalNumber?.match(/PF-(\d+)/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Math.max(acc, n);
      }, 0);
      const nextNum = maxNum + 1;
      const internalNumber = `PF-${String(nextNum).padStart(6, '0')}`;

      let subtotal = 0;
      let itbisTotal = 0;
      const lineItems = items.map((it) => {
        const lineTotal = it.qty * it.unitPrice;
        const itbisLine = lineTotal * (it.itbisRate / 100);
        subtotal += lineTotal;
        itbisTotal += itbisLine;
        return {
          itemName: it.itemName,
          sku: it.sku ?? null,
          qty: String(it.qty),
          unitPrice: String(it.unitPrice),
          itbisRate: String(it.itbisRate),
          lineTotal: String(lineTotal + itbisLine),
        };
      });

      const total = subtotal + itbisTotal;

      const [doc] = await db
        .insert(salesDocuments)
        .values({
          tenantId: req.tenantId,
          kind: 'PROFORMA',
          customerId: customerId ?? null,
          currency,
          subtotal: String(subtotal),
          itbis: String(itbisTotal),
          total: String(total),
          status: 'ISSUED',
          issueDate: new Date().toISOString().slice(0, 10),
          notes: notes ?? null,
          internalNumber,
        })
        .returning();

      if (!doc) {
        res.status(500).json({ error: 'Error al crear proforma' });
        return;
      }

      await db.insert(salesDocumentItems).values(
        lineItems.map((li, i) => ({
          documentId: doc.id,
          itemName: li.itemName,
          sku: li.sku,
          qty: li.qty,
          unitPrice: li.unitPrice,
          itbisRate: li.itbisRate,
          lineTotal: li.lineTotal,
          sortOrder: i,
        }))
      );

      res.status(201).json(doc);
    } catch (err) {
      console.error('Proforma create error:', err);
      res.status(500).json({ error: 'Error al crear proforma' });
    }
  }
);

/**
 * POST /api/sales/invoices
 * Crear factura fiscal (requiere FISCAL_READY)
 */
router.post(
  '/invoices',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  requireActiveSubscriptionMiddleware,
  requireFiscalReadyForWritesMiddleware,
  async (req, res) => {
    if (!req.tenantId || !req.user) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    const parsed = fiscalInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, req.tenantId))
        .limit(1);

      if (!tenant || tenant.country !== 'DO') {
        res.status(400).json({ error: 'Factura fiscal solo para tenants RD' });
        return;
      }

      const { customerId, docType: requestedDocType, currency, items, notes } = parsed.data;

      const defaultCurrency = tenant.defaultDocCurrency ?? 'DOP';
      const docCurrency = currency ?? defaultCurrency;

      let sequenceId: string | null = null;
      let fiscalType: (typeof dgiiSequences.$inferSelect.docType) | null = null;
      let ncfOrEcfNumber: string | null = null;

      type DocType = (typeof dgiiSequences.$inferSelect)['docType'];
      const preferredTypes: DocType[] = requestedDocType
        ? [requestedDocType]
        : ['ECF_E31', 'ECF_E32', 'NCF_B01', 'NCF_B02'];

      for (const dt of preferredTypes) {
        const [seq] = await db
          .select()
          .from(dgiiSequences)
          .where(
            and(
              eq(dgiiSequences.tenantId, req.tenantId),
              eq(dgiiSequences.docType, dt),
              eq(dgiiSequences.isActive, true)
            )
          )
          .limit(1);

        if (seq && seq.currentNumber < seq.endNumber) {
          const nextNum = seq.currentNumber + 1;
          const padded = String(nextNum).padStart(11, '0');
          ncfOrEcfNumber = `${seq.prefix}${seq.series ?? ''}${padded}`;
          fiscalType = seq.docType;
          sequenceId = seq.id;

          await db
            .update(dgiiSequences)
            .set({ currentNumber: nextNum })
            .where(eq(dgiiSequences.id, seq.id));

          break;
        }
      }

      if (!ncfOrEcfNumber || !fiscalType) {
        res.status(400).json({
          error: 'No hay secuencia DGII activa disponible. Configura secuencias en Fiscal RD.',
          code: 'NO_SEQUENCE',
        });
        return;
      }

      let subtotal = 0;
      let itbisTotal = 0;
      const lineItems = items.map((it) => {
        const lineTotal = it.qty * it.unitPrice;
        const itbisLine = lineTotal * (it.itbisRate / 100);
        subtotal += lineTotal;
        itbisTotal += itbisLine;
        return {
          itemName: it.itemName,
          sku: it.sku ?? null,
          qty: String(it.qty),
          unitPrice: String(it.unitPrice),
          itbisRate: String(it.itbisRate),
          lineTotal: String(lineTotal + itbisLine),
        };
      });

      const total = subtotal + itbisTotal;

      const [doc] = await db
        .insert(salesDocuments)
        .values({
          tenantId: req.tenantId,
          kind: 'FISCAL_INVOICE',
          customerId: customerId ?? null,
          currency: docCurrency,
          subtotal: String(subtotal),
          itbis: String(itbisTotal),
          total: String(total),
          status: 'ISSUED',
          issueDate: new Date().toISOString().slice(0, 10),
          notes: notes ?? null,
          fiscalType,
          ncfOrEcfNumber,
          sequenceId,
        })
        .returning();

      if (!doc) {
        res.status(500).json({ error: 'Error al crear factura' });
        return;
      }

      await db.insert(salesDocumentItems).values(
        lineItems.map((li, i) => ({
          documentId: doc.id,
          itemName: li.itemName,
          sku: li.sku,
          qty: li.qty,
          unitPrice: li.unitPrice,
          itbisRate: li.itbisRate,
          lineTotal: li.lineTotal,
          sortOrder: i,
        }))
      );

      const isEcf = fiscalType.startsWith('ECF_');
      if (isEcf) {
        const [trans] = await db
          .insert(ecfTransmissions)
          .values({
            tenantId: req.tenantId,
            documentId: doc.id,
            providerStatus: 'PENDING_SEND',
          })
          .returning();

        const adapter = getEcfAdapter(tenant.ecfProvider);
        const result = await adapter.sendInvoice(doc.id);

        if (result.success && result.trackingId && trans) {
          await db
            .update(ecfTransmissions)
            .set({
              providerTrackingId: result.trackingId,
              providerStatus: 'SENT',
              updatedAt: new Date(),
            })
            .where(eq(ecfTransmissions.id, trans.id));
        }
      }

      res.status(201).json(doc);
    } catch (err) {
      console.error('Fiscal invoice create error:', err);
      res.status(500).json({ error: 'Error al crear factura fiscal' });
    }
  }
);

export default router;
