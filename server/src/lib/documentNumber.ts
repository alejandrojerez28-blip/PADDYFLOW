import { db } from '../db/index.js';
import { documentCounters } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const COUNTER_CONFIG: Record<string, { prefix: string; padLength: number }> = {
  PROFORMA: { prefix: 'PF', padLength: 6 },
  FISCAL_INVOICE: { prefix: 'FV', padLength: 6 },
  PURCHASE: { prefix: 'PU', padLength: 6 },
  WEIGH_TICKET: { prefix: 'WT', padLength: 6 },
  LOT: { prefix: 'LOT', padLength: 6 },
};

/**
 * Asigna un número de documento único de forma transaccional (sin race conditions).
 * Usa document_counters con SELECT FOR UPDATE.
 * Si no existe counter, lo crea con next_number = MAX(existente) + 1 en SQL.
 */
export async function allocateDocumentNumber(
  tenantId: string,
  key: string
): Promise<string> {
  const config = COUNTER_CONFIG[key] ?? { prefix: key.slice(0, 2).toUpperCase(), padLength: 6 };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(documentCounters)
      .where(
        and(
          eq(documentCounters.tenantId, tenantId),
          eq(documentCounters.key, key)
        )
      )
      .for('update');

    if (existing) {
      const num = existing.nextNumber;
      await tx
        .update(documentCounters)
        .set({
          nextNumber: existing.nextNumber + 1,
          updatedAt: new Date(),
        })
        .where(eq(documentCounters.id, existing.id));
      return `${config.prefix}-${String(num).padStart(config.padLength, '0')}`;
    }

    // Crear counter: inicializar desde MAX existente (PROFORMA, WEIGH_TICKET)
    // Limitación: si no hay docs previos o parseo falla, nextNum=1
    let maxExisting = 0;
    if (key === 'PROFORMA') {
      try {
        const result = await tx.execute(
          sql`SELECT COALESCE(MAX(
            CASE WHEN internal_number ~ '^PF-[0-9]+$' 
            THEN CAST(SUBSTRING(internal_number FROM 4) AS INT) 
            ELSE 0 END
          ), 0)::int as max_num FROM sales_documents 
          WHERE tenant_id = ${tenantId} AND kind = 'PROFORMA'`
        );
        const rows = Array.isArray(result) ? result : [];
        const row = rows[0] as { max_num?: number } | undefined;
        maxExisting = Number(row?.max_num ?? 0);
      } catch {
        maxExisting = 0;
      }
    } else if (key === 'WEIGH_TICKET') {
      try {
        const result = await tx.execute(
          sql`SELECT COALESCE(MAX(
            CASE WHEN ticket_number ~ '^WT-[0-9]+$' 
            THEN CAST(SUBSTRING(ticket_number FROM 4) AS INT) 
            ELSE 0 END
          ), 0)::int as max_num FROM weigh_tickets 
          WHERE tenant_id = ${tenantId}`
        );
        const rows = Array.isArray(result) ? result : [];
        const row = rows[0] as { max_num?: number } | undefined;
        maxExisting = Number(row?.max_num ?? 0);
      } catch {
        maxExisting = 0;
      }
    } else if (key === 'LOT') {
      try {
        const result = await tx.execute(
          sql`SELECT COALESCE(MAX(
            CASE WHEN code ~ '^LOT-[0-9]+$' 
            THEN CAST(SUBSTRING(code FROM 5) AS INT) 
            ELSE 0 END
          ), 0)::int as max_num FROM lots 
          WHERE tenant_id = ${tenantId}`
        );
        const rows = Array.isArray(result) ? result : [];
        const row = rows[0] as { max_num?: number } | undefined;
        maxExisting = Number(row?.max_num ?? 0);
      } catch {
        maxExisting = 0;
      }
    }

    const nextNum = maxExisting + 1;
    await tx.insert(documentCounters).values({
      tenantId,
      key,
      prefix: config.prefix,
      nextNumber: nextNum + 1,
    });

    return `${config.prefix}-${String(nextNum).padStart(config.padLength, '0')}`;
  });
}
