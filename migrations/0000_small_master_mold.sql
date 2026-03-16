CREATE TABLE "admin_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"notion_page_id" text,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"unit" text,
	"default_value" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_entitlements_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "admin_product_entitlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"entitlement_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_product_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"notion_page_id" text,
	"product_id" integer NOT NULL,
	"entitlement_id" integer NOT NULL,
	"value" real,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"notion_page_id" text,
	"name" text NOT NULL,
	"audience" text NOT NULL,
	"kind" text NOT NULL,
	"billing_type" text NOT NULL,
	"price_monthly" real,
	"price_yearly" real,
	"price_one_time" real,
	"stripe_product_id" text,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"stripe_price_id_one_time" text,
	"logic_key" text,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"plan_type" text DEFAULT 'Subscription' NOT NULL,
	"quota_source" text,
	"active_instruction" text,
	"grant_entitlement_key" text,
	"grant_amount" integer,
	"credit_expiry_months" integer DEFAULT 12,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "employer_evidence_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"excerpt" text,
	"claim" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employer_verification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"employer_id" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"admin_notes" text,
	"decided_by" integer,
	"decided_at" timestamp,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entitlement_credit_consumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entitlement_key" text NOT NULL,
	"grant_id" integer NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"consumed_at" timestamp DEFAULT now() NOT NULL,
	"source_event" text,
	"ref_id" integer
);
--> statement-breakpoint
CREATE TABLE "entitlement_credit_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entitlement_key" text NOT NULL,
	"amount_granted" integer NOT NULL,
	"amount_remaining" integer NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'Active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlement_usage_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entitlement_key" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL
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
CREATE TABLE "import_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"source_domain" text NOT NULL,
	"company_name" text NOT NULL,
	"employer_website_domain" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_import_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"apify_run_id" text,
	"apify_dataset_id" text,
	"actor_input_json" jsonb,
	"stats_created" integer DEFAULT 0 NOT NULL,
	"stats_updated" integer DEFAULT 0 NOT NULL,
	"stats_skipped" integer DEFAULT 0 NOT NULL,
	"stats_expired" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb,
	"last_error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'apify' NOT NULL,
	"name" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_input_json" jsonb NOT NULL,
	"poll_interval_minutes" integer DEFAULT 360 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp,
	"last_successful_run_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
	"subcategory" text,
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
	"created_at" timestamp DEFAULT now(),
	"source_id" integer,
	"import_target_id" integer,
	"external_job_id" text,
	"source_url" text,
	"external_posted_at" timestamp,
	"external_created_at" timestamp,
	"external_valid_through" timestamp,
	"employment_type" text,
	"is_remote" boolean,
	"status" text DEFAULT 'active' NOT NULL,
	"imported_at" timestamp,
	"last_imported_at" timestamp,
	"last_admin_edited_at" timestamp,
	"raw_source_snippet" text
);
--> statement-breakpoint
CREATE TABLE "migration_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"completed_at" timestamp,
	"result" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "migration_state_key_unique" UNIQUE("key")
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
	"slug" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"intro_text" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"target_audience" text NOT NULL,
	"required_tier" text DEFAULT 'free' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"page_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "resources_slug_unique" UNIQUE("slug")
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
	"notion_employer_url" text,
	"employer_category" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_entitlements_notion_page_id_idx" ON "admin_entitlements" USING btree ("notion_page_id") WHERE "admin_entitlements"."notion_page_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_product_entitlements_product_entitlement_idx" ON "admin_product_entitlements" USING btree ("product_id","entitlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_product_overrides_product_entitlement_idx" ON "admin_product_overrides" USING btree ("product_id","entitlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_product_overrides_notion_page_id_idx" ON "admin_product_overrides" USING btree ("notion_page_id") WHERE "admin_product_overrides"."notion_page_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_products_notion_page_id_idx" ON "admin_products" USING btree ("notion_page_id") WHERE "admin_products"."notion_page_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "eei_request_idx" ON "employer_evidence_items" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evr_employer_active_idx" ON "employer_verification_requests" USING btree ("employer_id") WHERE "employer_verification_requests"."status" IN ('draft', 'submitted', 'needs_more');--> statement-breakpoint
CREATE INDEX "evr_status_idx" ON "employer_verification_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_usage_windows_user_key_start_idx" ON "entitlement_usage_windows" USING btree ("user_id","entitlement_key","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "import_targets_source_domain_idx" ON "import_targets" USING btree ("source_id","source_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_employer_external_key_idx" ON "jobs" USING btree ("employer_id","external_job_key") WHERE "jobs"."external_job_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_target_external_idx" ON "jobs" USING btree ("source_id","import_target_id","external_job_id") WHERE "jobs"."source_id" IS NOT NULL AND "jobs"."external_job_id" IS NOT NULL;