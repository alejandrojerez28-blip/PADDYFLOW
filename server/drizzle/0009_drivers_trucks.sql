-- Drivers (choferes)
CREATE TABLE IF NOT EXISTS "drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "id_number" varchar(64),
  "phone" varchar(64),
  "license" varchar(64),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "drivers_tenant_name_idx" ON "drivers" USING btree ("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "drivers_tenant_active_idx" ON "drivers" USING btree ("tenant_id", "is_active");

-- Trucks (camiones)
CREATE TABLE IF NOT EXISTS "trucks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plate" varchar(32) NOT NULL,
  "capacity_kg" varchar(32),
  "owner" varchar(255),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "trucks_tenant_plate_idx" ON "trucks" USING btree ("tenant_id", "plate");
CREATE INDEX IF NOT EXISTS "trucks_tenant_active_idx" ON "trucks" USING btree ("tenant_id", "is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "trucks_tenant_plate_unique" ON "trucks" USING btree ("tenant_id", "plate");

-- weigh_tickets: FKs a drivers y trucks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'weigh_tickets' AND constraint_name LIKE '%driver%'
  ) THEN
    ALTER TABLE "weigh_tickets" ADD CONSTRAINT "weigh_tickets_driver_id_drivers_id_fk"
      FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'weigh_tickets' AND constraint_name LIKE '%truck%'
  ) THEN
    ALTER TABLE "weigh_tickets" ADD CONSTRAINT "weigh_tickets_truck_id_trucks_id_fk"
      FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "weigh_tickets_tenant_truck_idx" ON "weigh_tickets" USING btree ("tenant_id", "truck_id");
