-- Enums para lotes y envíos
DO $$ BEGIN
  CREATE TYPE "lot_status" AS ENUM('OPEN', 'SENT', 'RECEIVED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "shipment_status" AS ENUM('CREATED', 'IN_TRANSIT', 'DELIVERED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Lots
CREATE TABLE IF NOT EXISTS "lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code" varchar(32) NOT NULL,
  "status" "lot_status" DEFAULT 'OPEN' NOT NULL,
  "notes" varchar(1024),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lots_tenant_code_unique" ON "lots" USING btree ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "lots_tenant_created_idx" ON "lots" USING btree ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "lots_tenant_status_idx" ON "lots" USING btree ("tenant_id", "status");

-- Lot inputs (pesadas asociadas al lote)
CREATE TABLE IF NOT EXISTS "lot_inputs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lot_id" uuid NOT NULL REFERENCES "lots"("id") ON DELETE CASCADE,
  "weigh_ticket_id" uuid NOT NULL REFERENCES "weigh_tickets"("id") ON DELETE CASCADE,
  "net_kg" numeric(14, 4) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lot_inputs_tenant_lot_ticket_unique" ON "lot_inputs" USING btree ("tenant_id", "lot_id", "weigh_ticket_id");
CREATE INDEX IF NOT EXISTS "lot_inputs_tenant_lot_idx" ON "lot_inputs" USING btree ("tenant_id", "lot_id");

-- Shipments
CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lot_id" uuid NOT NULL REFERENCES "lots"("id") ON DELETE CASCADE,
  "processor_id" uuid NOT NULL REFERENCES "processors"("id") ON DELETE CASCADE,
  "ship_date" timestamp with time zone,
  "driver_id" uuid REFERENCES "drivers"("id") ON DELETE SET NULL,
  "truck_id" uuid REFERENCES "trucks"("id") ON DELETE SET NULL,
  "shipped_kg" numeric(14, 4),
  "status" "shipment_status" DEFAULT 'CREATED' NOT NULL,
  "notes" varchar(1024),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "shipments_tenant_lot_idx" ON "shipments" USING btree ("tenant_id", "lot_id");
CREATE INDEX IF NOT EXISTS "shipments_tenant_processor_idx" ON "shipments" USING btree ("tenant_id", "processor_id");
CREATE INDEX IF NOT EXISTS "shipments_tenant_shipdate_idx" ON "shipments" USING btree ("tenant_id", "ship_date");

-- Bulk receipts
CREATE TABLE IF NOT EXISTS "bulk_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lot_id" uuid NOT NULL REFERENCES "lots"("id") ON DELETE CASCADE,
  "receipt_date" timestamp with time zone NOT NULL,
  "super_sacks_count" integer DEFAULT 0 NOT NULL,
  "total_kg" numeric(14, 4) NOT NULL,
  "notes" varchar(1024),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "bulk_receipts_tenant_lot_idx" ON "bulk_receipts" USING btree ("tenant_id", "lot_id");
CREATE INDEX IF NOT EXISTS "bulk_receipts_tenant_receiptdate_idx" ON "bulk_receipts" USING btree ("tenant_id", "receipt_date");
