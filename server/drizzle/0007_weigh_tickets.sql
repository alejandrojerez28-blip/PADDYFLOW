-- Enum tipo de pesada
DO $$ BEGIN
  CREATE TYPE "weigh_ticket_type" AS ENUM('PADDY', 'SUBPRODUCT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabla weigh_tickets (pesadas)
CREATE TABLE IF NOT EXISTS "weigh_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ticket_number" varchar(32),
  "type" "weigh_ticket_type" NOT NULL,
  "datetime" timestamp with time zone NOT NULL,
  "supplier_id" uuid,
  "driver_id" uuid,
  "truck_id" uuid,
  "gross_kg" numeric(14, 4) NOT NULL,
  "tare_kg" numeric(14, 4) NOT NULL,
  "net_kg" numeric(14, 4) NOT NULL,
  "notes" varchar(1024),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS "weigh_tickets_tenant_datetime_idx" ON "weigh_tickets" USING btree ("tenant_id", "datetime");
CREATE INDEX IF NOT EXISTS "weigh_tickets_tenant_type_idx" ON "weigh_tickets" USING btree ("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "weigh_tickets_tenant_supplier_idx" ON "weigh_tickets" USING btree ("tenant_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "weigh_tickets_tenant_driver_idx" ON "weigh_tickets" USING btree ("tenant_id", "driver_id");
