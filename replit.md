# LaneLogic Jobs - Transportation & Logistics Job Board

## Overview
LaneLogic Jobs is a search-first job board purpose-built for the transportation and logistics industry, inspired by the HiringCafe model but focused on a niche vertical. The platform prioritizes immediate job discovery — the homepage IS the search, with jobs loading instantly and infinite scroll replacing pagination. Marketing is minimal; the experience is built around getting job seekers to relevant roles as fast as possible.

**Business model:** Free for job seekers (account required to apply). Revenue comes from employer subscriptions, add-ons, and premium placement. Job seekers have generous free rolling quotas for metered actions (applications, searches), with optional paid credit packs for power users.

**Core differentiators:**
- Deep transportation taxonomy (15 categories, CDL types, route types, endorsements)
- Rich company profile pages — trucking companies get storefront-like profiles with fleet info, culture, photos, and active jobs
- Industry-specific content library (resources, blog)
- Programmatic SEO for transportation job searches (e.g., `/jobs/cdl-jobs-texas`)
- Social publishing pipeline for job promotion via Zapier

## User Preferences
Prioritize React with TypeScript, Tailwind CSS, and Shadcn UI for frontend development, ensuring a modern, clean, search-first interface with minimal chrome and generous whitespace. For the backend, stick to Express.js with TypeScript and PostgreSQL with Drizzle ORM. The admin product management system (replacing Notion) is the source of truth for products, entitlements, and pricing — changes to the entitlement resolver or Stripe integration should be explained thoroughly before proceeding. Design direction: HiringCafe-inspired, niche-focused, search-first UX.

## System Architecture

### UI/UX Decisions
The platform uses React with TypeScript, Wouter for routing, and Tailwind CSS + Shadcn UI for a clean, modern design. Framer Motion provides animations. The UI follows a search-first philosophy: the homepage begins with search + filters + results by default. A configurable hero section (`homepageHeroEnabled`, default OFF, controlled via Admin → Design Settings) can optionally render a minimal hero below the header. Authentication uses a modal overlay (login/signup popup) rather than dedicated pages — triggered from navbar links, "Post a Job" button, and dropdown menu. Dashboards for different user roles (Job Seeker, Employer, Admin) share a common sidebar layout. Programmatic SEO pages are dynamically generated with templated content and meta tags.

### Technical Implementations
- **Frontend**: Built with React + TypeScript, employing TanStack Query for data fetching and state management.
- **Backend**: An Express.js server in TypeScript handles API requests, authentication, and integration with external services.
- **Database**: PostgreSQL is used as the primary data store, managed with Drizzle ORM for type-safe interactions.
- **Authentication**: Passport.js with a local strategy and session-based authentication. Login/signup rendered as modal overlays via `AuthModalProvider` context (`client/src/components/AuthModal.tsx`). `/login` and `/register` routes redirect to homepage and open the modal. Account required to apply for jobs.
- **Admin Product Management (Source of Truth)**: Products, entitlements, and overrides are managed directly in the app's database via admin dashboard CRUD. This replaces the previous Notion-based registry sync. The entitlement resolver reads from admin tables first; falls back to Notion snapshots only when admin tables are empty. Notion sync code remains in the codebase but is no longer the active data source.
- **Entitlement Enforcement**: A runtime entitlement resolver, keyed by Stripe Price ID, enforces access. It is fail-closed — missing overrides result in denied access (value=0 for Limits, enabled=false for Flags). Admin users have bypass logic. Free job seekers get default entitlements.
- **Programmatic SEO**: Generates dynamic job listing pages based on categories and states (e.g., `/jobs/cdl-jobs-texas`) with tiered keyword matching and dynamic SEO metadata. Legacy URLs are redirected.
- **Admin Bulk Job Import**: Allows administrators to upload job listings via CSV, supporting upserts, row-level validation, and error reporting. Required CSV columns: `externalJobKey`, `title`, `description`, `requirements`. Optional `experienceLevelYears` accepts only `0-2 | 2-5 | 5-10 | 10+` (invalid values skip row with `INVALID_EXPERIENCE_LEVEL`; legacy `experienceLevel` column aliased to `experienceLevelYears`). Skills/keywords stored as `rawSkills`/`rawKeywords` arrays in `job_metadata` JSONB. Tagging architecture stub (`server/taggingValidator.ts`) is disabled by default (`TAGGING_ARCH_ENABLED=false`); when enabled, validates keywords against canonical tags and rejects ambiguous mappings. CSV columns `category` and `subcategory` are validated against the job taxonomy (see below).
- **Job Category Taxonomy**: A fixed 2-level taxonomy of 15 categories with specific subcategories, defined as a canonical constant in `shared/jobTaxonomy.ts` (using `as const`). Validation rule: both `category` and `subcategory` may be null, but if either is set, both must be valid. `validateCategoryPair()` enforces this uniformly across create/update/bulk-update/CSV-import. The `categories` table (type="job") remains for backward compatibility but job forms/filters exclusively use the taxonomy. Admin has a "Missing category" filter option to review uncategorized jobs. One-time migration endpoint: `POST /api/admin/jobs/migrate-categories` maps legacy values using exact match + explicit legacy mapping table → null for unmapped values.

### Feature Specifications

#### Search-First Homepage (PLANNED — implementation pending)
- Homepage begins directly with search bar + filters + job results. No hero section by default.
- Jobs load immediately on page load with infinite scroll (auto-load more on scroll, no pagination buttons).
- Sticky search bar and filters that persist as user scrolls through results.
- Configurable hero: `homepageHeroEnabled` (default OFF) in Admin → Design Settings. When ON, a minimal hero renders below the header before the search/results area.
- Current state: Homepage has a hero section with "Show More" button pagination. Needs redesign to match search-first vision.

#### Rich Company Profile Pages (PLANNED — implementation pending)
- Each employer/company gets a storefront-like profile page at `/companies/:slug`.
- Profile includes: company logo, cover photo, about/culture description, fleet information, benefits, locations, and all active job listings.
- Companies can upload photos, describe their fleet, highlight driver benefits and culture.
- Both claimed (registered employer) and unclaimed (mentioned in job listings) companies appear in the directory.
- Current state: `/employers` page shows a searchable card directory linking to job search filtered by company name. No dedicated company profile pages exist yet.

#### Pricing Model: Free for Job Seekers, Employers Pay
- **Job seekers**: Free to browse, search, and apply. Account required to apply. Metered actions (applications, searches) have generous free rolling 30-day quotas. Optional paid credit packs for power users (PLANNED — see Job Seeker Top-Ups).
- **Employers**: Revenue comes from employer subscriptions (job posting limits, featured listings, resume access) and one-time add-ons (Resume Access, Featured Employer).
- Current state: Pricing page shows tiers for both job seekers and employers. Needs update to reflect free-for-seekers model.

#### Job Seeker Top-Ups (PLANNED — implementation pending)
- Rolling 30-day free quota tied to signup date for metered actions.
- Purchased credit packs carry over across windows, expire 12 months from purchase date.
- FIFO consumption: free quota first, then soonest-expiring purchased credits.
- Seeker dashboard shows: free quota remaining, next reset date, purchased credits with per-pack expiration.
- Purchase UI discloses "Credits expire 12 months from purchase date."

#### Job Listings
- Comprehensive job posts with internal/external apply options. Job descriptions support Markdown rendering via `react-markdown` + `remark-gfm` (component: `client/src/components/MarkdownDescription.tsx`); raw HTML is disallowed; plain-text descriptions get a pretty-print fallback that converts common labels to headings.

#### User Dashboards
- Role-specific dashboards for job seekers (applications, resume, membership), employers (post jobs, manage jobs, applicants, CSV upload), and administrators.
- Admin sidebar has 8 top-level items: Users (with collapsible sub-items for Job Seeker Users and Employer Users), All Jobs (with Post a Job and Upload Jobs CSV buttons on page), Pages & Resources (landing page linking to Site Pages, Custom Pages, Resources), Blog Posts, Database (categories/industries), Coupons, Design Settings, Social Publishing.
- Routes: `/dashboard/admin/:section` and `/dashboard/admin/:section/:subsection`.

#### Stripe Integration
- Handles employer subscription-based memberships and one-time add-on purchases (Resume Access, Featured Employer).
- The system uses `stripe-replit-sync` for webhook management and database synchronization.

#### Resume Management
- Job seekers can create text-based resumes.

#### Blog and Resources
- Content management for blog posts and a member-gated resource library.

#### Site Management
- Admin tools for managing site settings, custom pages, categories, and coupons.
- Includes a **footer theme editor** (`DesignSettings.tsx`) with color pickers for footer background (+ opacity slider), text, link, and link-hover colors, plus page background. Live preview panel shows real-time appearance. All footer colors validated against WCAG AA contrast ratio (4.5:1) both client-side (inline badges) and server-side (PUT `/api/settings` returns 400 with `errors[]` on failure). Color utilities in `shared/colorUtils.ts`: `parseHex`, `normalizeHex`, `alphaBlend`, `contrastRatio`, `computeEffectiveBg`, `checkFooterContrast`. Footer component (`Footer.tsx`) applies colors via CSS custom properties set from settings.

#### Add-on Purchase Flow
- One-time payments for features like "Resume Access" (additive views, 365-day expiry) and "Featured Employer" (7-day window, extends on repurchase).

#### Publish/Unpublish Flow
- All content types (jobs, blog posts, resources, pages) have an `isPublished` boolean column. `isPublished === true` is the sole publish gate; `publishedAt` is metadata only. New items default to draft (`isPublished: false`). Public API endpoints filter by `isPublished` for non-admin users. Admin sees all content. Toggle is in each entity's edit Dialog in the admin dashboard.

#### Social Publishing Module
- Admin module for creating, scheduling, and queuing social media posts for jobs, blog posts, and resources via Zapier webhook. MVP platforms: LinkedIn, Facebook Page, Instagram Business.
  - **Schema**: `social_posts` table (`shared/schema.ts`) stores entity references, platform list, copy per platform, scheduling, status (draft/queued/sent/failed/canceled), and Zapier provider data.
  - **Shared utilities**: `shared/socialUtils.ts` (SUPPORTED_PLATFORMS, char limits, UTM builder, copy templates, validation); `server/socialHelpers.ts` (canonical URL builder, shareability checker).
  - **API endpoints** (all admin-gated except callback):
    - `POST /api/admin/social-posts` — Create draft social post
    - `PATCH /api/admin/social-posts/:id` — Edit platforms/copy/schedule
    - `GET /api/admin/social-posts` — List with optional status/entityType filters
    - `POST /api/admin/social-posts/:id/queue` — Queue to Zapier (draft/failed only)
    - `POST /api/admin/social-posts/:id/retry` — Re-queue failed post
    - `POST /api/admin/social-posts/:id/cancel` — Cancel draft only (queued returns 409)
    - `POST /api/integrations/zapier/social-posts/callback` — Secured with `X-Zapier-Secret` header matching `ZAPIER_CALLBACK_SECRET`
    - `POST /api/admin/social-posts/test-webhook` — Send test payload to webhook
    - `GET /api/admin/social-posts/webhook-status` — Check if webhook URL is configured
  - **Frontend components**:
    - `ShareToSocialModal` (`client/src/components/ShareToSocialModal.tsx`) — Platform selection, copy editor with char limits, scheduling, preview. Opened from Share buttons on admin card rows and edit Dialogs.
    - `SocialPublishing` (`client/src/pages/dashboard/SocialPublishing.tsx`) — Social Queue tab (table with filters, retry/cancel actions) + Connections tab (webhook status, test button). Accessible at `/dashboard/admin/social`.
  - **Env vars**: `ZAPIER_SOCIAL_POST_WEBHOOK_URL`, `ZAPIER_CALLBACK_SECRET`

#### Resource Detail Pages
- Public route `/resources/:id` with component `client/src/pages/ResourceDetail.tsx` and API endpoint `GET /api/resources/:id` (gated on `isPublished`).

#### Admin Product Management
- Full CRUD for products, entitlements, and overrides replacing Notion as the source of truth. Admin dashboard section at `/dashboard/admin/products` with three tabs (Products, Entitlements, Overrides).
  - **Schema**: `admin_products`, `admin_entitlements`, `admin_product_overrides`, `admin_product_entitlements` (join), `migration_state` tables in `shared/schema.ts`.
  - **Storage**: Full CRUD methods in `server/storage.ts` for all product management tables.
  - **API Routes** (`server/adminProductRoutes.ts`): All admin-gated.
    - `GET/POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/:id`
    - `GET/POST /api/admin/entitlements`, `PATCH/DELETE /api/admin/entitlements/:id`
    - `GET/POST /api/admin/product-overrides`, `PATCH/DELETE /api/admin/product-overrides/:id`
    - `POST /api/admin/products/seed-from-snapshot` — One-time import from Notion registry snapshot, guarded by `migration_state` record.
    - `POST /api/admin/products/seed-reset` — Clears all product data and migration state.
  - **Stripe auto-create**: Creating a paid product auto-creates Stripe Product + Price objects. Deleting deactivates the Stripe product.
  - **Entitlement resolver** (`server/registry/entitlementResolver.ts`): `loadSnapshots()` now checks admin tables first; falls back to Notion snapshots when admin tables are empty. Maps admin DB rows to existing `ProductRow`/`EntitlementRow`/`OverrideRow` shapes. Products with both monthly+yearly prices emit separate `ProductRow` entries per billing cycle.
  - **Frontend**: `client/src/pages/dashboard/ProductManagement.tsx` — Tabbed UI for Products, Entitlements, Overrides. Seed from Snapshot section with one-click import and reset.

#### Auth Modal
- Login and signup are rendered as modal popups overlaying the current page, not dedicated routes.
- `AuthModalProvider` context wraps the app; `useAuthModal().open("login"|"signup")` triggers from any component.
- Navbar "Log in" link, "Post a Job" button, and dropdown menu items open the modal.
- `/login` and `/register` routes redirect to homepage and open the modal.
- Modal supports switching between login and signup modes inline.
- Component: `client/src/components/AuthModal.tsx`.

## Product Roadmap (major workstreams to reach vision)

### Phase 1: Foundation
- [x] Auth modal (login/signup as popups)
- [x] Admin product management (full CRUD, Stripe auto-create)
- [x] Job category taxonomy (15 categories, 2-level)
- [x] Cloudflare R2 image storage
- [x] Social publishing module
- [ ] PRD update to HiringCafe vision (this task)

### Phase 2: Search-First Homepage
- [ ] Redesign homepage: remove hero (default OFF), start with search + filters + job results
- [ ] Implement infinite scroll (auto-load on scroll, replace "Show More" button)
- [ ] Sticky search bar and filters on scroll
- [ ] Rename `heroHidden` setting to `homepageHeroEnabled` (inverted, default OFF)
- [ ] Update Admin → Design Settings with hero toggle

### Phase 3: Rich Company Profiles
- [ ] Create `companies` table or extend employer schema with profile fields (cover photo, fleet info, benefits, culture description, photo gallery)
- [ ] Build `/companies/:slug` public profile page
- [ ] Update `/employers` directory to link to profile pages instead of filtered job search
- [ ] Allow employers to manage their company profile from dashboard
- [ ] Support unclaimed company profiles (auto-generated from job listings)

### Phase 4: Free for Seekers + Top-Ups
- [ ] Remove job seeker subscription tiers from pricing page
- [ ] Implement rolling 30-day free quota enforcement for metered actions
- [ ] Add credit grant tables (entitlement_usage_windows, entitlement_credit_grants, entitlement_credit_consumptions)
- [ ] Build FIFO credit consumption logic
- [ ] Wire Stripe one-time top-up purchase to credit grants
- [ ] Build seeker dashboard quota/credits UI
- [ ] Add purchase disclosure ("Credits expire 12 months from purchase date")

### Phase 5: Polish & Growth
- [ ] Expiration reminder notifications for credit packs
- [ ] Enhanced job search (relevance scoring, saved searches)
- [ ] Employer analytics dashboard
- [ ] Mobile-optimized experience

## Image Uploads / Cloudflare R2
- Image uploads are handled by `POST /api/upload` using multer memory storage.
- When R2 is configured (env vars below), images are uploaded to Cloudflare R2 and a public `https://` URL is returned. When R2 is not configured, images fall back to local disk storage in `/uploads/`.
- CSV uploads remain on disk storage (temporary processing files).
- Legacy `/uploads/...` URLs are still served via `express.static` for backward compatibility.
- Migration endpoint: `POST /api/admin/migrate-uploads-to-r2` — migrates local images to R2 and updates site_settings + user records.
- R2 utility: `server/r2.ts` — `uploadToR2()`, `deleteFromR2()`, `isR2Configured()`.
- **Required env vars for R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.

## External Dependencies
- **Cloudflare R2**: S3-compatible object storage for persistent image uploads across deployments. Configured via env vars above.
- **Stripe**: For processing all employer payments, including subscriptions and one-time add-ons. Integrates with `stripe-replit-sync` for webhook handling and database synchronization.
- **Mailgun**: Utilized for sending emails, specifically for contact form submissions.
- **Notion API**: Legacy — previously the source of truth for product/pricing/entitlement data. Sync code remains in codebase but admin database tables are now authoritative. Notion sync is a fallback only when admin tables are empty.
- **Zapier Webhooks**: Used for social media publishing. The app sends social post payloads to per-platform Zapier webhooks, which handle posting to LinkedIn, Facebook, and Instagram. Zapier reports results back via a secured callback endpoint.
