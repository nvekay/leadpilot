ALTER TYPE "public"."lead_status" ADD VALUE 'approved' BEFORE 'replied';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reply_subject" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "failed_step" text;