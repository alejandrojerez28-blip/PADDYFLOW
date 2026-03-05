ALTER TYPE "public"."subscription_status" ADD VALUE 'incomplete';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'incomplete_expired';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'unpaid';--> statement-breakpoint
ALTER TYPE "public"."subscription_status" ADD VALUE 'paused';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"stripe_event_id" varchar(255) NOT NULL,
	"type" varchar(128) NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "plan" SET DEFAULT 'basic';--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "subscription_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_price_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "had_subscription_before" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_events_tenant_id_idx" ON "billing_events" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "public"."tenants" ALTER COLUMN "plan" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."plan";--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('basic', 'pro', 'starter', 'enterprise');--> statement-breakpoint
ALTER TABLE "public"."tenants" ALTER COLUMN "plan" SET DATA TYPE "public"."plan" USING "plan"::"public"."plan";