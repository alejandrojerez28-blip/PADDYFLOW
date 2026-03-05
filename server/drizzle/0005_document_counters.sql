CREATE TABLE IF NOT EXISTS "document_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"prefix" varchar(16) NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_counters_tenant_key_unique" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_counters_tenant_key_idx" ON "document_counters" USING btree ("tenant_id","key");
