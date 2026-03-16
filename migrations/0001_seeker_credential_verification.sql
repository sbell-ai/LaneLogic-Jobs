ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seeker_track" text DEFAULT 'Unknown';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seeker_verification_status" text NOT NULL DEFAULT 'unverified';
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "tags" text[];
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seeker_credential_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"category" text NOT NULL DEFAULT 'license',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "seeker_credential_requirements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seeker_requirement_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_key" text NOT NULL,
	"condition_type" text NOT NULL,
	"condition_value" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seeker_verification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"seeker_id" integer NOT NULL,
	"status" text NOT NULL DEFAULT 'draft',
	"requirements_snapshot" text[],
	"admin_notes" text,
	"decided_by" integer,
	"decided_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seeker_credential_evidence_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"requirement_key" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"excerpt" text,
	"claim" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "svr_seeker_active_idx" ON "seeker_verification_requests" USING btree ("seeker_id") WHERE "seeker_verification_requests"."status" IN ('draft', 'submitted', 'needs_more');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "svr_status_idx" ON "seeker_verification_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scei_request_idx" ON "seeker_credential_evidence_items" USING btree ("request_id");
