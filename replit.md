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
    Blog.tsx           - Blog listing
    BlogPost.tsx       - Individual blog post
    Resources.tsx      - Member-gated resource library
    Pricing.tsx        - Membership pricing page (job seeker + employer tabs)
    Contact.tsx        - Contact form (sends email via Mailgun)
    Login.tsx          - Login page
    Register.tsx       - Registration page
    dashboard/
      DashboardLayout.tsx       - Shared sidebar layout for all dashboards
      Overview.tsx              - Default dashboard overview
      JobSeekerDashboard.tsx    - Applications, Resume, Membership tabs, Profile with privacy toggles (show/hide Profile, Name, Current Employer)
      EmployerDashboard.tsx     - Post Job, My Jobs, Applicants, CSV Upload, Membership
      AdminDashboard.tsx        - Users, Jobs, Resources, Blog management
  components/
    layout/Navbar.tsx  - Top navigation bar
    layout/Footer.tsx  - Footer component
  hooks/
    use-auth.ts        - Authentication hook
    use-jobs.ts        - Jobs query hook
    use-applications.ts
    use-resources.ts

server/
  index.ts             - Server entry point
  routes.ts            - API routes + Stripe payment endpoints
  storage.ts           - Database storage layer (IStorage interface)
  db.ts                - Database connection

shared/
  schema.ts            - Drizzle ORM schema (users, jobs, applications, resources, blogPosts, resumes)
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
- `users` - role (admin/employer/job_seeker), membershipTier, employer profile fields
- `jobs` - job listings
- `applications` - job listings applications linking seekers to jobs
- `resources` - member resource library gating
- `blog_posts` - blog posts
- `resumes` - text-based resumes for job seekers
- `site_settings` - key-value site configuration
- `categories` - labels for jobs, industries, blogs
- `coupons` - promo codes

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