CREATE TYPE "public"."doc_type" AS ENUM('NCF_B01', 'NCF_B02', 'NCF_B14', 'NCF_B15', 'ECF_E31', 'ECF_E32', 'ECF_E33', 'ECF_E34', 'ECF_E41', 'ECF_E43', 'ECF_E44', 'ECF_E45');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('FISCAL_INVOICE', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'ISSUED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."ecf_provider" AS ENUM('NONE', 'PROVIDER_X', 'PROVIDER_Y');--> statement-breakpoint
CREATE TYPE "public"."ecf_provider_status" AS ENUM('PENDING_SEND', 'PENDING', 'SENT', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('BASIC', 'FISCAL_PENDING', 'FISCAL_READY');--> statement-breakpoint
CREATE TYPE "public"."tax_mode" AS ENUM('GENERIC', 'DO_DGII');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"rnc" varchar(32),
	"address" varchar(512),
	"email" varchar(255),
	"phone" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dgii_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"series" varchar(32),
	"prefix" varchar(16) NOT NULL,
	"start_number" integer NOT NULL,
	"end_number" integer NOT NULL,
	"current_number" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ecf_transmissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"provider_status" "ecf_provider_status" DEFAULT 'PENDING_SEND' NOT NULL,
	"provider_tracking_id" varchar(255),
	"xml_storage_key" varchar(512),
	"response_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_document_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"sku" varchar(64),
	"qty" numeric(14, 4) NOT NULL,
	"unit_price" numeric(14, 4) NOT NULL,
	"itbis_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sales_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"customer_id" uuid,
	"currency" varchar(3) DEFAULT 'DOP' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"itbis" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"issue_date" date,
	"notes" varchar(1024),
	"fiscal_type" "doc_type",
	"ncf_or_ecf_number" varchar(64),
	"sequence_id" uuid,
	"internal_number" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "onboarding_status" "onboarding_status" DEFAULT 'BASIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "tax_mode" "tax_mode" DEFAULT 'GENERIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "legal_name" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trade_name" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "rnc" varchar(32);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "fiscal_address" varchar(512);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "fiscal_email" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "fiscal_phone" varchar(64);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "itbis_registered" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_doc_currency" varchar(3) DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ecf_provider" "ecf_provider" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "ecf_provider_config" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dgii_sequences" ADD CONSTRAINT "dgii_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ecf_transmissions" ADD CONSTRAINT "ecf_transmissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ecf_transmissions" ADD CONSTRAINT "ecf_transmissions_document_id_sales_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."sales_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_document_items" ADD CONSTRAINT "sales_document_items_document_id_sales_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."sales_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_sequence_id_dgii_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."dgii_sequences"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dgii_sequences_tenant_id_idx" ON "dgii_sequences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dgii_sequences_tenant_doctype_idx" ON "dgii_sequences" USING btree ("tenant_id","doc_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ecf_transmissions_tenant_id_idx" ON "ecf_transmissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ecf_transmissions_document_id_idx" ON "ecf_transmissions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_document_items_document_id_idx" ON "sales_document_items" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_documents_tenant_id_idx" ON "sales_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_documents_tenant_kind_idx" ON "sales_documents" USING btree ("tenant_id","kind");