CREATE TYPE "public"."lead_source" AS ENUM('form', 'email', 'demo');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('received', 'analyzed', 'synced', 'awaiting_approval', 'replied', 'rejected', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"data" jsonb,
	"cost_usd" numeric(10, 6),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "lead_source" NOT NULL,
	"external_id" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"subject" text,
	"body" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "lead_status" DEFAULT 'received' NOT NULL,
	"analysis" jsonb,
	"score" integer,
	"score_reasons" jsonb,
	"crm_contact_id" text,
	"crm_company_id" text,
	"crm_deal_id" text,
	"draft_reply" text,
	"replied_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"icp" jsonb NOT NULL,
	"reply_signature" text NOT NULL,
	"calendar_url" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_events_lead_created" ON "lead_events" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_source_external_id" ON "leads" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "leads_status_received" ON "leads" USING btree ("status","received_at");