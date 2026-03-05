-- Enums para inventario
DO $$ BEGIN
  CREATE TYPE "item_category" AS ENUM('FINISHED', 'SUBPRODUCT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "inventory_direction" AS ENUM('IN', 'OUT', 'ADJUST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "inventory_ref_type" AS ENUM('BULK_RECEIPT', 'SALE', 'PURCHASE', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Items
CREATE TABLE IF NOT EXISTS "items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "sku" varchar(64),
  "category" "item_category" NOT NULL,
  "uom" varchar(16) DEFAULT 'kg' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "items_tenant_name_unique" ON "items" USING btree ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "items_tenant_category_idx" ON "items" USING btree ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "items_tenant_active_idx" ON "items" USING btree ("tenant_id", "is_active");

-- Inventory moves (kardex)
CREATE TABLE IF NOT EXISTS "inventory_moves" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "item_id" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "datetime" timestamp with time zone DEFAULT now() NOT NULL,
  "direction" "inventory_direction" NOT NULL,
  "qty_kg" numeric(14, 4) NOT NULL,
  "ref_type" "inventory_ref_type" NOT NULL,
  "ref_id" uuid,
  "notes" varchar(1024),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "inventory_moves_tenant_item_datetime_idx" ON "inventory_moves" USING btree ("tenant_id", "item_id", "datetime");
CREATE INDEX IF NOT EXISTS "inventory_moves_tenant_reftype_datetime_idx" ON "inventory_moves" USING btree ("tenant_id", "ref_type", "datetime");

-- Bulk receipt splits
CREATE TABLE IF NOT EXISTS "bulk_receipt_splits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "bulk_receipt_id" uuid NOT NULL REFERENCES "bulk_receipts"("id") ON DELETE CASCADE,
  "item_id" uuid NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
  "qty_kg" numeric(14, 4) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "bulk_receipt_splits_tenant_receipt_item_unique" ON "bulk_receipt_splits" USING btree ("tenant_id", "bulk_receipt_id", "item_id");
CREATE INDEX IF NOT EXISTS "bulk_receipt_splits_tenant_receipt_idx" ON "bulk_receipt_splits" USING btree ("tenant_id", "bulk_receipt_id");
