-- Enums para liquidaciones
DO $$ BEGIN
  CREATE TYPE "rounding_mode" AS ENUM('NONE', 'ROUND_2', 'ROUND_0');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "settlement_status" AS ENUM('DRAFT', 'APPROVED', 'PAID', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- weigh_ticket_quality (análisis por pesada)
CREATE TABLE IF NOT EXISTS "weigh_ticket_quality" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "weigh_ticket_id" uuid NOT NULL REFERENCES "weigh_tickets"("id") ON DELETE CASCADE,
  "sample_date" timestamp with time zone DEFAULT now() NOT NULL,
  "moisture_pct" numeric(5, 2),
  "impurity_pct" numeric(5, 2),
  "broken_pct" numeric(5, 2),
  "chalky_pct" numeric(5, 2),
  "remarks" varchar(1024),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "weigh_ticket_quality_weigh_ticket_unique" UNIQUE("weigh_ticket_id")
);
CREATE INDEX IF NOT EXISTS "weigh_ticket_quality_tenant_ticket_idx" ON "weigh_ticket_quality" USING btree ("tenant_id", "weigh_ticket_id");

-- supplier_price_rules (reglas de pago por suplidor)
CREATE TABLE IF NOT EXISTS "supplier_price_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "effective_from" date NOT NULL,
  "base_price_per_kg" numeric(12, 4) NOT NULL,
  "currency" varchar(8) DEFAULT 'DOP' NOT NULL,
  "moisture_base_pct" numeric(5, 2) DEFAULT '14.00' NOT NULL,
  "moisture_penalty_per_pct" numeric(12, 4) DEFAULT '0' NOT NULL,
  "impurity_base_pct" numeric(5, 2) DEFAULT '1.00' NOT NULL,
  "impurity_penalty_per_pct" numeric(12, 4) DEFAULT '0' NOT NULL,
  "rounding_mode" "rounding_mode" DEFAULT 'ROUND_2' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "supplier_price_rules_tenant_supplier_from_idx" ON "supplier_price_rules" USING btree ("tenant_id", "supplier_id", "effective_from");
CREATE INDEX IF NOT EXISTS "supplier_price_rules_tenant_supplier_active_idx" ON "supplier_price_rules" USING btree ("tenant_id", "supplier_id", "is_active");

-- supplier_settlements (liquidaciones)
CREATE TABLE IF NOT EXISTS "supplier_settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "period_from" date NOT NULL,
  "period_to" date NOT NULL,
  "status" "settlement_status" DEFAULT 'DRAFT' NOT NULL,
  "total_net_kg" numeric(14, 4) DEFAULT '0' NOT NULL,
  "gross_amount" numeric(14, 4) DEFAULT '0' NOT NULL,
  "deductions" numeric(14, 4) DEFAULT '0' NOT NULL,
  "net_payable" numeric(14, 4) DEFAULT '0' NOT NULL,
  "notes" varchar(1024),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "supplier_settlements_tenant_supplier_idx" ON "supplier_settlements" USING btree ("tenant_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_settlements_tenant_status_idx" ON "supplier_settlements" USING btree ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "supplier_settlements_tenant_period_idx" ON "supplier_settlements" USING btree ("tenant_id", "period_from", "period_to");

-- supplier_settlement_lines
CREATE TABLE IF NOT EXISTS "supplier_settlement_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "settlement_id" uuid NOT NULL REFERENCES "supplier_settlements"("id") ON DELETE CASCADE,
  "weigh_ticket_id" uuid NOT NULL REFERENCES "weigh_tickets"("id") ON DELETE CASCADE,
  "net_kg" numeric(14, 4) NOT NULL,
  "price_per_kg" numeric(12, 4) NOT NULL,
  "moisture_pct" numeric(5, 2),
  "impurity_pct" numeric(5, 2),
  "penalty_amount" numeric(14, 4) DEFAULT '0' NOT NULL,
  "line_amount" numeric(14, 4) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "supplier_settlement_lines_weigh_ticket_unique" UNIQUE("weigh_ticket_id")
);
CREATE INDEX IF NOT EXISTS "supplier_settlement_lines_tenant_settlement_idx" ON "supplier_settlement_lines" USING btree ("tenant_id", "settlement_id");
