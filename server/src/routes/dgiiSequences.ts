import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { dgiiSequences, tenants } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { tenantContextMiddleware } from '../middleware/tenantContext.js';
import { requireTenantMiddleware } from '../middleware/requireTenant.js';

const router = Router();

const DOC_TYPE_PREFIX: Record<string, string> = {
  NCF_B01: 'B01',
  NCF_B02: 'B02',
  NCF_B14: 'B14',
  NCF_B15: 'B15',
  ECF_E31: 'E31',
  ECF_E32: 'E32',
  ECF_E33: 'E33',
  ECF_E34: 'E34',
  ECF_E41: 'E41',
  ECF_E43: 'E43',
  ECF_E44: 'E44',
  ECF_E45: 'E45',
};

const createSequenceSchema = z.object({
  docType: z.enum([
    'NCF_B01', 'NCF_B02', 'NCF_B14', 'NCF_B15',
    'ECF_E31', 'ECF_E32', 'ECF_E33', 'ECF_E34', 'ECF_E41', 'ECF_E43', 'ECF_E44', 'ECF_E45',
  ]),
  series: z.string().optional(),
  startNumber: z.number().int().min(1),
  endNumber: z.number().int().min(1),
  expiresAt: z.string().optional(),
});

/**
 * GET /api/dgii/sequences
 * Listar secuencias del tenant
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

    try {
      const seqs = await db
        .select()
        .from(dgiiSequences)
        .where(eq(dgiiSequences.tenantId, req.tenantId))
        .orderBy(dgiiSequences.docType);

      res.json(seqs);
    } catch (err) {
      console.error('DGII sequences list error:', err);
      res.status(500).json({ error: 'Error al listar secuencias' });
    }
  }
);

/**
 * POST /api/dgii/sequences
 * Crear secuencia(s) DGII (AdminTenant)
 */
router.post(
  '/',
  authMiddleware,
  tenantContextMiddleware,
  requireTenantMiddleware,
  async (req, res) => {
    if (!req.tenantId || !req.user) {
      res.status(403).json({ error: 'Contexto de tenant no disponible' });
      return;
    }

    if (req.user.role !== 'AdminTenant') {
      res.status(403).json({ error: 'Solo AdminTenant puede crear secuencias' });
      return;
    }

    const body = Array.isArray(req.body) ? req.body : [req.body];
    const parsed = z.array(createSequenceSchema).safeParse(body);

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
        res.status(400).json({ error: 'Secuencias DGII solo para tenants RD (country=DO)' });
        return;
      }

      if (tenant.onboardingStatus === 'BASIC') {
        res.status(400).json({ error: 'Completa el perfil fiscal antes de cargar secuencias' });
        return;
      }

      const created: typeof dgiiSequences.$inferSelect[] = [];

      for (const item of parsed.data) {
        if (item.startNumber > item.endNumber) {
          res.status(400).json({ error: `Rango inválido para ${item.docType}: start > end` });
          return;
        }

        const prefix = DOC_TYPE_PREFIX[item.docType] ?? item.docType;

        const [seq] = await db
          .insert(dgiiSequences)
          .values({
            tenantId: req.tenantId,
            docType: item.docType,
            series: item.series ?? null,
            prefix,
            startNumber: item.startNumber,
            endNumber: item.endNumber,
            currentNumber: item.startNumber - 1,
            isActive: true,
            expiresAt: item.expiresAt ?? null,
          })
          .returning();

        if (seq) created.push(seq);
      }

      // Si hay al menos 1 secuencia activa y perfil fiscal completo => FISCAL_READY
      const hasEcf = created.some((s) =>
        ['ECF_E31', 'ECF_E32', 'ECF_E33', 'ECF_E34', 'ECF_E41', 'ECF_E43', 'ECF_E44', 'ECF_E45'].includes(s.docType)
      );
      const hasNcf = created.some((s) =>
        ['NCF_B01', 'NCF_B02', 'NCF_B14', 'NCF_B15'].includes(s.docType)
      );

      const allSeqs = await db
        .select()
        .from(dgiiSequences)
        .where(and(eq(dgiiSequences.tenantId, req.tenantId), eq(dgiiSequences.isActive, true)));

      const hasActiveSequence = allSeqs.length > 0;
      const hasFiscalProfile = !!tenant.legalName && !!tenant.rnc && !!tenant.fiscalAddress;

      if (hasActiveSequence && hasFiscalProfile) {
        await db
          .update(tenants)
          .set({ onboardingStatus: 'FISCAL_READY', updatedAt: new Date() })
          .where(eq(tenants.id, req.tenantId));
      }

      res.status(201).json(created);
    } catch (err) {
      console.error('DGII sequences create error:', err);
      res.status(500).json({ error: 'Error al crear secuencias' });
    }
  }
);

export default router;
