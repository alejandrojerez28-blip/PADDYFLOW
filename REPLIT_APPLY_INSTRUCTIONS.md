# Cómo aplicar los cambios de Cursor en Replit

Replit bloquea escritura en `.git`, así que no puedes hacer `git pull`. Aquí tienes opciones para sincronizar.

---

## Opción 1: Archivo patch (recomendado)

Se generó `cursor-changes.patch` (~758 KB) con el diff completo del commit `fc3fa7c`.

**En Replit:**

1. Sube `cursor-changes.patch` al proyecto (o copia su contenido).
2. En la terminal de Replit:
   ```bash
   git apply cursor-changes.patch
   ```
3. Si hay conflictos, `git apply` lo indicará. Revisa los archivos marcados y resuélvelos.

**Alternativa con `patch`:**
```bash
patch -p1 < cursor-changes.patch
```

---

## Opción 2: Lista de archivos para copiar manualmente

Si prefieres aplicar cambios archivo por archivo, estos son los 45 archivos del commit:

### Nuevos (crear)
- `AUDITORIA_TECNICA.md`
- `MERGE_REPORT_AUDITORIAS.md`
- `client/.env.example`
- `client/src/config/support.ts`
- `client/src/pages/Inventory.tsx`
- `client/src/pages/LegalPrivacy.tsx`
- `client/src/pages/LegalTerms.tsx`
- `client/src/pages/LotDetail.tsx`
- `client/src/pages/Lots.tsx`
- `client/src/pages/ThirdParties.tsx`
- `client/src/pages/WeighTicketPrint.tsx`
- `client/src/pages/WeighTickets.tsx`
- `client/src/pages/YieldReport.tsx`
- `client/src/vite-env.d.ts`
- `docs/faq.md`, `docs/limitations.md`, `docs/privacy.md`, `docs/quickstart.md`, `docs/terms.md`
- `server/drizzle/0007_weigh_tickets.sql` … `0011_inventory_items_moves_splits.sql`
- `server/drizzle/meta/0004_snapshot.json`
- `server/src/routes/bulkReceipts.ts`, `customers.ts`, `drivers.ts`, `inventory.ts`, `items.ts`, `lots.ts`, `onboarding.ts`, `processors.ts`, `suppliers.ts`, `trucks.ts`, `weighTickets.ts`

### Modificados (reemplazar)
- `README.md`
- `client/src/App.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/Home.tsx`
- `server/drizzle/meta/_journal.json`
- `server/src/db/schema.ts`
- `server/src/index.ts`
- `server/src/lib/documentNumber.ts`
- `server/src/routes/reports.ts`

---

## Opción 3: Recrear el Repl desde GitHub

Si el remoto ya tiene el commit `fc3fa7c`:

1. Crea un nuevo Repl importando desde `https://github.com/alejandrojerez28-blip/PADDYFLOW`
2. O desconecta y vuelve a conectar el repo en el Repl actual (si Replit lo permite).

---

## Migraciones SQL

Después de aplicar los cambios, ejecuta las migraciones en orden:

```bash
# En Replit, contra tu PostgreSQL
psql $DATABASE_URL -f server/drizzle/0007_weigh_tickets.sql
psql $DATABASE_URL -f server/drizzle/0008_third_parties.sql
psql $DATABASE_URL -f server/drizzle/0009_drivers_trucks.sql
psql $DATABASE_URL -f server/drizzle/0010_lots_shipments_receipts.sql
psql $DATABASE_URL -f server/drizzle/0011_inventory_items_moves_splits.sql
```

O usa `drizzle-kit push` si lo tienes configurado.
