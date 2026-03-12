CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"job_seeker_id" integer NOT NULL,
	"resume_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "import_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"filename" text,
	"file_hash" text,
	"rows_total" integer DEFAULT 0,
	"rows_imported" integer DEFAULT 0,
	"rows_skipped" integer DEFAULT 0,
	"status" text DEFAULT 'Processing' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"external_job_key" text,
	"title" text NOT NULL,
	"company_name" text,
	"job_type" text,
	"category" text,
	"industry" text,
	"description" text NOT NULL,
	"requirements" text NOT NULL,
	"benefits" text,
	"location_city" text,
	"location_state" text,
	"location_country" text,
	"salary" text,
	"apply_url" text,
	"is_external_apply" boolean DEFAULT false,
	"job_metadata" jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"seo_title" text,
	"meta_description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "registry_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"registry_name" text NOT NULL,
	"event_type" text NOT NULL,
	"severity" text NOT NULL,
	"validation_rule_id" text,
	"row_url" text,
	"reason" text,
	"active_snapshot_id" integer,
	"last_known_good_snapshot_id" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registry_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"registry_name" text NOT NULL,
	"content_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"row_urls" jsonb NOT NULL,
	"valid_row_count" integer DEFAULT 0 NOT NULL,
	"invalid_row_count" integer DEFAULT 0 NOT NULL,
	"is_last_known_good" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"intro_text" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"target_audience" text NOT NULL,
	"required_tier" text DEFAULT 'free' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_seeker_id" integer NOT NULL,
	"content" text NOT NULL,
	"is_upload" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" text PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"entity_url" text NOT NULL,
	"title_snapshot" text NOT NULL,
	"image_url" text,
	"link_url" text NOT NULL,
	"platforms" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"copy_master" text,
	"copy_by_platform" jsonb,
	"provider" text DEFAULT 'zapier' NOT NULL,
	"provider_request_id" text,
	"provider_job_id" text,
	"provider_response" jsonb,
	"last_error" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'job_seeker' NOT NULL,
	"membership_tier" text DEFAULT 'free' NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"company_address" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"about_company" text,
	"profile_image" text,
	"company_logo" text,
	"show_profile" boolean DEFAULT true NOT NULL,
	"show_name" boolean DEFAULT true NOT NULL,
	"show_current_employer" boolean DEFAULT true NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"resume_access_expires_at" timestamp,
	"featured_employer_expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_employer_external_key_idx" ON "jobs" USING btree ("employer_id","external_job_key") WHERE "jobs"."external_job_key" IS NOT NULL;