import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  supplierSettlements,
  supplierSettlementLines,
  supplierPriceRules,
  weighTickets,
  weighTicketQuality,
  suppliers,
} from '../db/schema.js';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const WRITE_ROLES = ['AdminTenant', 'Contabilidad'];

function canWrite(role: string): boolean {
  return WRITE_ROLES.includes(role);
}

const createSchema = z.object({
  supplierId: z.string().uuid(),
  periodFrom: z.string().refine((s) => !isNaN(new Date(s).getTime()), { message: 'periodFrom inválido' }),
  periodTo: z.string().refine((s) => !isNaN(new Date(s).getTime()), { message: 'periodTo inválido' }),
});

const statusSchema = z.object({
  status: z.enum(['APPROVED', 'PAID', 'CANCELED']),
});

function round(val: number, mode: 'NONE' | 'ROUND_2' | 'ROUND_0'): number {
  if (mode === 'ROUND_2') return Math.round(val * 100) / 100;
  if (mode === 'ROUND_0') return Math.round(val);
  return val;
}

/**
 * Find the applicable price rule for a weigh ticket (effective_from <= datetime, is_active, latest)
 */
async function getPriceRuleForTicket(
  tenantId: string,
  supplierId: string,
  ticketDatetime: Date
): Promise<typeof supplierPriceRules.$inferSelect | null> {
  const dateStr = ticketDatetime.toISOString().slice(0, 10);
  const [rule] = await db
    .select()
    .from(supplierPriceRules)
    .where(
      and(
        eq(supplierPriceRules.tenantId, tenantId),
        eq(supplierPriceRules.supplierId, supplierId),
        eq(supplierPriceRules.isActive, true),
        lte(supplierPriceRules.effectiveFrom, dateStr)
      )
    )
    .orderBy(desc(supplierPriceRules.effectiveFrom))
    .limit(1);
  return rule ?? null;
}

/**
 * Calculate line amount for a weigh ticket
 */
function calculateLine(
  netKg: number,
  pricePerKg: number,
  moisturePct: number | null,
  impurityPct: number | null,
  moistureBase: number,
  moisturePenalty: number,
  impurityBase: number,
  impurityPenalty: number,
  roundingMode: 'NONE' | 'ROUND_2' | 'ROUND_0'
): { base: number; penalty: number; lineAmount: number } {
  const base = netKg * pricePerKg;
  let penaltyMoisture = 0;
  let penaltyImpurity = 0;
  if (moisturePct != null && moisturePenalty > 0) {
    penaltyMoisture = Math.max(0, moisturePct - moistureBase) * moisturePenalty * netKg;
  }
  if (impurityPct != null && impurityPenalty > 0) {
    penaltyImpurity = Math.max(0, impurityPct - impurityBase) * impurityPenalty * netKg;
  }
  const penalty = penaltyMoisture + penaltyImpurity;
  const lineAmount = round(base - penalty, roundingMode);
  return { base, penalty, lineAmount };
}

/**
 * POST /api/supplier-settlements
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
      res.status(403).json({ error: 'Sin permiso para crear liquidaciones' });
      return;
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const { supplierId, periodFrom, periodTo } = parsed.data;
    const fromDate = new Date(periodFrom + 'T00:00:00Z');
    const toDate = new Date(periodTo + 'T23:59:59.999Z');

    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, req.tenantId!)))
      .limit(1);
    if (!supplier) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    // Get weigh tickets already used in settlements
    const usedTicketIds = await db
      .select({ weighTicketId: supplierSettlementLines.weighTicketId })
      .from(supplierSettlementLines)
      .where(eq(supplierSettlementLines.tenantId, req.tenantId!));
    const usedSet = new Set(usedTicketIds.map((r) => r.weighTicketId));

    // Get weigh tickets for supplier in period
    const tickets = await db
      .select()
      .from(weighTickets)
      .where(
        and(
          eq(weighTickets.tenantId, req.tenantId!),
          eq(weighTickets.supplierId, supplierId),
          gte(weighTickets.datetime, fromDate),
          lte(weighTickets.datetime, toDate)
        )
      )
      .orderBy(weighTickets.datetime);

    const availableTickets = tickets.filter((t) => !usedSet.has(t.id));
    if (availableTickets.length === 0) {
      res.status(400).json({ error: 'No hay pesadas disponibles para liquidar en este periodo' });
      return;
    }

    const ticketIds = availableTickets.map((t) => t.id);
    const qualityRows = await db
      .select()
      .from(weighTicketQuality)
      .where(
        and(
          eq(weighTicketQuality.tenantId, req.tenantId!),
          inArray(weighTicketQuality.weighTicketId, ticketIds)
        )
      );
    const qualityByTicket: Record<string, (typeof qualityRows)[0]> = {};
    for (const q of qualityRows) qualityByTicket[q.weighTicketId] = q;

    const lines: Array<{
      weighTicketId: string;
      netKg: number;
      pricePerKg: number;
      moisturePct: number | null;
      impurityPct: number | null;
      penaltyAmount: number;
      lineAmount: number;
    }> = [];

    let totalNetKg = 0;
    let grossAmount = 0;
    let deductions = 0;

    for (const ticket of availableTickets) {
      const rule = await getPriceRuleForTicket(req.tenantId!, supplierId, ticket.datetime);
      if (!rule) {
        res.status(400).json({
          error: `No hay regla de precio vigente para la pesada ${ticket.ticketNumber ?? ticket.id} (${ticket.datetime.toISOString().slice(0, 10)})`,
        });
        return;
      }

      const netKg = parseFloat(ticket.netKg);
      const pricePerKg = parseFloat(rule.basePricePerKg);
      const moistureBase = parseFloat(rule.moistureBasePct);
      const moisturePenalty = parseFloat(rule.moisturePenaltyPerPct);
      const impurityBase = parseFloat(rule.impurityBasePct);
      const impurityPenalty = parseFloat(rule.impurityPenaltyPerPct);
      const roundingMode = rule.roundingMode as 'NONE' | 'ROUND_2' | 'ROUND_0';

      const quality = qualityByTicket[ticket.id];
      const moisturePct = quality?.moisturePct != null ? parseFloat(quality.moisturePct) : null;
      const impurityPct = quality?.impurityPct != null ? parseFloat(quality.impurityPct) : null;

      const { base, penalty, lineAmount } = calculateLine(
        netKg,
        pricePerKg,
        moisturePct,
        impurityPct,
        moistureBase,
        moisturePenalty,
        impurityBase,
        impurityPenalty,
        roundingMode
      );

      lines.push({
        weighTicketId: ticket.id,
        netKg,
        pricePerKg,
        moisturePct,
        impurityPct,
        penaltyAmount: penalty,
        lineAmount,
      });

      totalNetKg += netKg;
      grossAmount += base;
      deductions += penalty;
    }

    const netPayable = round(grossAmount - deductions, 'ROUND_2');

    try {
      const [settlement] = await db
        .insert(supplierSettlements)
        .values({
          tenantId: req.tenantId,
          supplierId,
          periodFrom,
          periodTo,
          status: 'DRAFT',
          totalNetKg: String(totalNetKg),
          grossAmount: String(grossAmount),
          deductions: String(deductions),
          netPayable: String(netPayable),
        })
        .returning();

      for (const line of lines) {
        await db.insert(supplierSettlementLines).values({
          tenantId: req.tenantId,
          settlementId: settlement!.id,
          weighTicketId: line.weighTicketId,
          netKg: String(line.netKg),
          pricePerKg: String(line.pricePerKg),
          moisturePct: line.moisturePct != null ? String(line.moisturePct) : null,
          impurityPct: line.impurityPct != null ? String(line.impurityPct) : null,
          penaltyAmount: String(line.penaltyAmount),
          lineAmount: String(line.lineAmount),
        });
      }

      const [supplierRow] = await db
        .select({ name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

      const actualLines = await db
        .select()
        .from(supplierSettlementLines)
        .where(eq(supplierSettlementLines.settlementId, settlement!.id));

      res.status(201).json({
        ...settlement,
        supplierName: supplierRow?.name ?? null,
        lines: actualLines,
      });
    } catch (err) {
      console.error('Settlement create error:', err);
      res.status(500).json({ error: 'Error al crear liquidación' });
    }
  }
);

/**
 * GET /api/supplier-settlements?supplierId=&status=&periodFrom=&periodTo=
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

    const supplierId = req.query.supplierId as string | undefined;
    const status = req.query.status as string | undefined;
    const periodFrom = req.query.periodFrom as string | undefined;
    const periodTo = req.query.periodTo as string | undefined;

    try {
      const conditions = [eq(supplierSettlements.tenantId, req.tenantId)];
      if (supplierId) conditions.push(eq(supplierSettlements.supplierId, supplierId));
      if (status && ['DRAFT', 'APPROVED', 'PAID', 'CANCELED'].includes(status)) {
        conditions.push(eq(supplierSettlements.status, status as 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELED'));
      }
      if (periodFrom) conditions.push(gte(supplierSettlements.periodFrom, periodFrom));
      if (periodTo) conditions.push(lte(supplierSettlements.periodTo, periodTo));

      const list = await db
        .select({
          id: supplierSettlements.id,
          supplierId: supplierSettlements.supplierId,
          supplierName: suppliers.name,
          periodFrom: supplierSettlements.periodFrom,
          periodTo: supplierSettlements.periodTo,
          status: supplierSettlements.status,
          totalNetKg: supplierSettlements.totalNetKg,
          grossAmount: supplierSettlements.grossAmount,
          deductions: supplierSettlements.deductions,
          netPayable: supplierSettlements.netPayable,
          createdAt: supplierSettlements.createdAt,
        })
        .from(supplierSettlements)
        .leftJoin(suppliers, eq(supplierSettlements.supplierId, suppliers.id))
        .where(and(...conditions))
        .orderBy(desc(supplierSettlements.createdAt))
        .limit(200);

      res.json(list);
    } catch (err) {
      console.error('Settlements list error:', err);
      res.status(500).json({ error: 'Error al listar liquidaciones' });
    }
  }
);

/**
 * GET /api/supplier-settlements/:id
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
    const [row] = await db
      .select({
        id: supplierSettlements.id,
        supplierId: supplierSettlements.supplierId,
        periodFrom: supplierSettlements.periodFrom,
        periodTo: supplierSettlements.periodTo,
        status: supplierSettlements.status,
        totalNetKg: supplierSettlements.totalNetKg,
        grossAmount: supplierSettlements.grossAmount,
        deductions: supplierSettlements.deductions,
        netPayable: supplierSettlements.netPayable,
        notes: supplierSettlements.notes,
        createdAt: supplierSettlements.createdAt,
        updatedAt: supplierSettlements.updatedAt,
        supplierName: suppliers.name,
      })
      .from(supplierSettlements)
      .leftJoin(suppliers, eq(supplierSettlements.supplierId, suppliers.id))
      .where(and(eq(supplierSettlements.id, id), eq(supplierSettlements.tenantId, req.tenantId!)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: 'Liquidación no encontrada' });
      return;
    }

    const lines = await db
      .select()
      .from(supplierSettlementLines)
      .where(
        and(
          eq(supplierSettlementLines.settlementId, id),
          eq(supplierSettlementLines.tenantId, req.tenantId!)
        )
      )
      .orderBy(supplierSettlementLines.createdAt);

    res.json({
      ...row,
      supplierName: row.supplierName ?? null,
      lines,
    });
  }
);

/**
 * PUT /api/supplier-settlements/:id/status
 */
router.put(
  '/:id/status',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }
    if (!canWrite(req.user?.role ?? '')) {
      res.status(403).json({ error: 'Sin permiso para cambiar estado' });
      return;
    }

    const id = req.params.id;
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Estado inválido', details: parsed.error.flatten() });
      return;
    }

    const [existing] = await db
      .select()
      .from(supplierSettlements)
      .where(and(eq(supplierSettlements.id, id), eq(supplierSettlements.tenantId, req.tenantId!)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: 'Liquidación no encontrada' });
      return;
    }

    const validTransitions: Record<string, string[]> = {
      DRAFT: ['APPROVED', 'CANCELED'],
      APPROVED: ['PAID', 'CANCELED'],
      PAID: [],
      CANCELED: [],
    };
    const allowed = validTransitions[existing.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      res.status(400).json({ error: `No se puede cambiar de ${existing.status} a ${parsed.data.status}` });
      return;
    }

    try {
      const [updated] = await db
        .update(supplierSettlements)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(supplierSettlements.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error('Settlement status update error:', err);
      res.status(500).json({ error: 'Error al actualizar estado' });
    }
  }
);

export default router;
