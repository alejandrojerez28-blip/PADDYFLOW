-- Customers: añadir is_active (si no existe)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS "customers_tenant_active_idx" ON "customers" USING btree ("tenant_id", "is_active");

-- Suppliers
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "rnc_or_id" varchar(64),
  "phone" varchar(64),
  "address" varchar(512),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "suppliers_tenant_name_idx" ON "suppliers" USING btree ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_active_idx" ON "suppliers" USING btree ("tenant_id", "is_active");

-- Processors
CREATE TABLE IF NOT EXISTS "processors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "contact_name" varchar(255),
  "phone" varchar(64),
  "address" varchar(512),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "processors_tenant_name_idx" ON "processors" USING btree ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "processors_tenant_active_idx" ON "processors" USING btree ("tenant_id", "is_active");

-- weigh_tickets: FK a suppliers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'weigh_tickets' AND constraint_name LIKE '%supplier%'
  ) THEN
    ALTER TABLE "weigh_tickets" ADD CONSTRAINT "weigh_tickets_supplier_id_suppliers_id_fk"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL;
  END IF;
END $$;
