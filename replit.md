# LaneLogic Jobs - Transportation Sector Job Board

## Overview
A full-stack job board platform specifically for the transportation industry, featuring membership-based access for job seekers and employers, resource libraries, blog, dashboards, and Stripe payment integration.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter routing, TanStack Query, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Passport.js (local strategy, session-based)
- **Payments**: Stripe (subscription-based memberships)
- **Email**: Mailgun (contact form submissions)
- **Build**: Vite (frontend), tsx (backend)

## Project Structure

client/src/
  pages/
    Home.tsx           - Landing page with job search + hero
    Jobs.tsx           - Searchable/filterable job board
    JobDetail.tsx      - Individual job page with apply button
    JobsByTypeAndState.tsx - Programmatic SEO pages at /jobs/:jobType/:state with dynamic meta tags, templated SEO content, and related searches
    Blog.tsx           - Blog listing
    BlogPost.tsx       - Individual blog post
    Resources.tsx      - Member-gated resource library
    Pricing.tsx        - Notion-driven pricing page (Monthly/Yearly toggle, Stripe Price ID checkout)
    Contact.tsx        - Contact form (sends email via Mailgun)
    Login.tsx          - Login page
    Register.tsx       - Registration page
    dashboard/
      DashboardLayout.tsx       - Shared sidebar layout for all dashboards
      Overview.tsx              - Default dashboard overview
      JobSeekerDashboard.tsx    - Applications, Resume, Membership tabs (Notion-driven entitlements), Profile with privacy toggles
      EmployerDashboard.tsx     - Post Job, My Jobs, Applicants, CSV Upload, Membership (Notion-driven entitlements + Add-on purchase)
      AdminDashboard.tsx        - Users, Jobs, Resources, Blog, Custom Pages management
    DynamicPage.tsx            - Public renderer for admin-created custom pages (renders at /<slug> root level, also /pages/:slug for legacy)
  components/
    layout/Navbar.tsx  - Top navigation bar
    layout/Footer.tsx  - Footer component
  hooks/
    use-auth.ts        - Authentication hook
    use-jobs.ts        - Jobs query hook
    use-applications.ts
    use-resources.ts

server/
  index.ts             - Server entry point (registry sync startup + 15-min interval)
  routes.ts            - API routes + Stripe payment endpoints + entitlement guards + add-on fulfillment
  storage.ts           - Database storage layer (IStorage interface)
  db.ts                - Database connection
  registry/
    notionSync.ts      - Fetches & transforms all 4 Notion registries into typed snapshots
    syncAll.ts         - Atomic sync orchestrator: fetch → validate → promote (all-or-nothing)
    snapshotStore.ts   - Postgres snapshot storage (registry_snapshots table)
    entitlementResolver.ts - Runtime entitlement enforcement (fail-closed, keyed by Stripe Price ID)

shared/
  schema.ts            - Drizzle ORM schema (users, jobs, applications, resources, blogPosts, resumes, registry_snapshots)
  routes.ts            - API route contracts with Zod schemas



## User Roles
- **admin**: Full platform management (users, jobs, resources, blog)
- **employer**: Post jobs, view applicants, CSV bulk upload
- **job_seeker**: Browse jobs, apply, manage resumes

## Seed Accounts (for testing)
- Admin: `admin@transpojobs.com` / `password123`
- Employer: `employer@trucking.com` / `password123`
- Job Seeker: `seeker@example.com` / `password123`

## Stripe Integration (stripe-replit-sync)
- Uses `stripe-replit-sync` package for automatic webhook management and DB sync
- Stripe schema auto-created in PostgreSQL on startup via `runMigrations()`
- Webhook endpoint: `POST /api/stripe/webhook` (managed automatically)
- Checkout: `POST /api/payments/create-checkout-session`
- Customer portal: `POST /api/payments/portal`
- Publishable key: `GET /api/payments/config`
- Products seeded via `npx tsx server/seed-products.ts`

### Stripe Products Created (Sandbox)
- TranspoJobs Basic - Job Seeker: $19/mo
- TranspoJobs Premium - Job Seeker: $49/mo
- TranspoJobs Basic - Employer: $79/mo
- TranspoJobs Premium - Employer: $199/mo

### Files
- `server/stripeClient.ts` - Stripe client factory (reads credentials from Replit connectors API)
- `server/webhookHandlers.ts` - Webhook processor
- `server/seed-products.ts` - Script to create Stripe products

## Jobs Schema (key fields)
- `title`, `companyName`, `jobType` (Full-time/Part-time/Contract/Seasonal/Owner-Operator/Lease Purchase/Temporary)
- `locationCity`, `locationState`, `locationCountry` (split location fields, not a single string)
- `description`, `requirements`, `benefits`, `salary`
- `isExternalApply`, `applyUrl`

## Database Tables
- `users` - role (admin/employer/job_seeker), membershipTier, employer profile fields, `resumeAccessExpiresAt`, `featuredEmployerExpiresAt` (add-on tracking)
- `jobs` - job listings
- `applications` - job listings applications linking seekers to jobs
- `resources` - member resource library gating
- `blog_posts` - blog posts
- `resumes` - text-based resumes for job seekers
- `site_settings` - key-value site configuration
- `categories` - labels for jobs, industries, blogs
- `coupons` - promo codes
- `registry_snapshots` - Notion registry sync snapshots (products_pricing, features_entitlements, product_entitlement_overrides, compliance_rules)

## Key Features
- Job listings with external/internal apply flows
- Resume creation (text-based)
- CSV bulk upload for jobs
- Membership gating on resource library
- Blog with admin publishing and categories
- Role-based dashboard routing
- Site design settings (CSS variables, logo, announcements, footer, social links)
- Admin site pages editor
- Categories & labels system
- Coupon code system
- Notion SOT registry sync (see below)
- Notion-driven pricing page with Monthly/Yearly toggle
- Fail-closed entitlement enforcement keyed by Stripe Price ID
- Add-on purchase flow (Resume Access, Featured Employer)

## Notion SOT Registry Sync System

### Overview
The app syncs 4 canonical Notion registries to validated Postgres snapshots atomically. Runtime never reads Notion directly — only validated snapshots. If sync validation fails, the last-known-good snapshot is retained.

### Verified Notion Database IDs
| Registry | Database ID |
|---|---|
| Products & Pricing | `3154caed-dabf-803d-a6a8-cc7b8f17b80a` |
| Features & Entitlements | `23d7f753-a0d1-48bc-be8f-7cb3e9706956` |
| Product Entitlement Overrides | `90052bfc-79c9-418d-98b2-41b295be9dad` |
| Compliance Rules | `37c447b4-7e93-4939-961e-2f82c158e41f` |

### Sync Flow (server/registry/syncAll.ts)
1. Fetch all 4 registries from Notion (via notionSync.ts)
2. Normalize and hash each payload
3. Per-registry validation (uniqueness, type consistency, Stripe ID checks)
4. Cross-registry validation (every override-required product must have overrides for all included entitlements)
5. All-or-nothing promotion: only if ALL 4 pass validation do all 4 snapshots get promoted to active
6. Runs at server startup + every 15 minutes

### Entitlement Resolver (server/registry/entitlementResolver.ts)
- Primary key: Stripe Price ID (each billing cycle has its own Price ID)
- Fail-closed: missing override = deny (value=0 for Limit, enabled=false for Flag)
- Admin users: bypass via Admin/Flag product (notionPageId lookup)
- Free users (no subscription): Starter - Job Seeker defaults (notionPageId lookup)
- Add-on merge: Resume Access adds to base resume_views_per_month; Featured Employer checks 7-day window

### Entitlement Guards (server/routes.ts)
- `POST /api/jobs`: checks `job_posts_per_month`
- `POST /api/applications`: checks `applications_per_month`
- `GET /api/user/entitlements`: returns resolved entitlements for the current user

### Add-On Purchase Flow
- Top-up products (Resume Access, Featured Employer) use Stripe `mode: "payment"` (one-time)
- On success, `POST /api/payments/fulfill-addon` sets expiry fields on the user record
- Resume Access: 365-day expiry, additive to base resume views
- Featured Employer: 7-day window, extends on repurchase (no stacking)

### Pricing API (GET /api/registry/pricing)
- Returns sellable products (Active, Subscription/Top-up, with Stripe Price ID) + free tier
- Excludes Admin/Flag products
- Groups by audience (Employer/Job Seeker)
- Frontend renders with Monthly/Yearly toggle

---

If anything above conflicts with this Notion SOT Contract, follow the Notion SOT Contract.

# Notion SOT Contract (MVP) — must follow

## Non-negotiable rules
1) Notion is read-only
- The app must never write to Notion.

2) Run from validated snapshots (never live reads)
- Implement a sync job that reads Notion registries and writes a validated snapshot to Postgres (or a snapshot table).
- Runtime must read only from the latest valid snapshot.
- If validation fails, keep using the last-known-good snapshot and alert.

## Canonical docs (do not override)
- LaneLogic Jobs: Master PRD & Registry 2026 (index + decision log)
- Engineering Standards — Performance, Security, Integrations (LaneLogic Jobs)
- PRD — Product Requirements (LaneLogic Jobs)

## Canonical registries (source of truth)
- Products & Pricing (LaneLogic Jobs)
- Features & Entitlements (LaneLogic Jobs)
- Product Entitlement Overrides (LaneLogic Jobs)
- Compliance Rules (LaneLogic Jobs) (publish gating, as used)

## Pricing + Entitlements enforcement contract (implement exactly)
1) Inclusion semantics
- Products include entitlements via Products & Pricing → Entitlements relation.
- Entitlements relation means included entitlements.

2) Fail-closed requirement
- For every included entitlement, an Active override must exist for (Product/SKU, Entitlement).
- Missing overrides fail closed.

3) Override mapping
- If entitlement Type = Limit: use override Value (number) OR Is Unlimited = true.
- If entitlement Type = Flag: use override Enabled = true/false.

4) Add-on semantics (decided)
- Resume Access is additive to base quotas.
- Featured Employer sets a 7-day window; repurchase while active extends expiry (no stacking).

5) Not enforcement
- Legacy quota columns on Products & Pricing are deprecated; do not use for enforcement.
- Benefit Tags is marketing-only; do not use for enforcement.

6) Stripe mapping rules
- Admin Override is not sold in Stripe.
- Starter - Job Seeker exists in Notion with price 0 and is granted by default.
- All Stripe-sold Active SKUs must have Stripe Product ID + Stripe Price ID.
- Tier names and prices are driven by Notion Products & Pricing; do not hardcode.