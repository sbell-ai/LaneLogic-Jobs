# LaneLogic Jobs - Transportation & Logistics Job Board

## Overview
LaneLogic Jobs is a search-first job board tailored for the transportation and logistics industry. Its primary purpose is to connect job seekers with relevant roles as quickly as possible, with the homepage functioning directly as the search interface, featuring instant job loading and infinite scroll. The platform operates on a business model where job seekers use the service for free (requiring an account for applications), and revenue is generated from employer subscriptions, add-ons, and premium placements.

Key capabilities include a deep transportation taxonomy, rich company profiles that act as storefronts for trucking companies, an industry-specific content library, programmatic SEO for specialized job searches, and a social publishing pipeline for job promotion. The vision is to be the leading niche job board in the transportation and logistics sector.

## User Preferences
Prioritize React with TypeScript, Tailwind CSS, and Shadcn UI for frontend development, ensuring a modern, clean, search-first interface with minimal chrome and generous whitespace. For the backend, stick to Express.js with TypeScript and PostgreSQL with Drizzle ORM. The admin product management system (replacing Notion) is the source of truth for products, entitlements, and pricing — changes to the entitlement resolver or Stripe integration should be explained thoroughly before proceeding. Design direction: HiringCafe-inspired, niche-focused, search-first UX.

## System Architecture

### UI/UX Decisions
The front end utilizes React, TypeScript, Wouter for routing, and Tailwind CSS with Shadcn UI for a modern aesthetic. Framer Motion is integrated for animations. The design philosophy is "search-first," where the homepage immediately presents search functionalities, filters, and job results. Authentication is handled via a modal overlay for login/signup, accessible from various UI elements. User dashboards are role-specific (Job Seeker, Employer, Admin) and share a consistent sidebar layout. Programmatic SEO pages are dynamically generated with templated content and metadata.

### Technical Implementations
- **Frontend**: React + TypeScript, with TanStack Query for data fetching.
- **Backend**: Express.js server in TypeScript manages APIs and integrations.
- **Database**: PostgreSQL with Drizzle ORM for type-safe data interactions.
- **Authentication**: Passport.js with session-based authentication, using a modal-based flow.
- **Admin Product Management**: Products, entitlements, and overrides are managed directly via an admin dashboard, serving as the authoritative source. This includes auto-creation of Stripe products/prices. The "Refresh from Notion" button syncs Notion registry data into both `registry_snapshots` (runtime entitlement resolution) AND `admin_products`/`admin_entitlements`/`admin_product_overrides` tables (admin UI), using `notion_page_id` as the stable upsert key to prevent duplicates.
- **Entitlement Enforcement**: A runtime resolver, keyed by Stripe Price ID, enforces access based on defined entitlements.
- **AI Crawlability / GEO**: Canonical host enforcement (`https://lanelogicjobs.com`, non-www, 301 redirect from www), `robots.txt` allowing AI bots (GPTBot, ChatGPT-User, ClaudeBot) while blocking private routes, dynamic `sitemap.xml` with published-only entities and `lastmod`, `<link rel="canonical">` on all pages via `useCanonical` hook, `llms.txt` for AI systems. Spec from Notion SOT.
- **Programmatic SEO**: Dynamic generation of job listing pages for specific categories and locations, with tiered keyword matching and dynamic metadata.
- **Admin Bulk Job Import**: CSV-based job upload functionality with validation and error reporting, including handling of experience levels and a fixed 2-level job category taxonomy.
- **Job Category Taxonomy**: A canonical 2-level taxonomy defined in `shared/jobTaxonomy.ts`, enforced across the platform.
- **Search-First Homepage**: Planned redesign to remove the hero section by default, immediately displaying search, filters, and infinite-scrolling job results.
- **Rich Company Profile Pages**: Planned feature for dedicated, storefront-like company profiles with detailed information and active job listings.
- **Pricing Model**: Free for job seekers (with fair-use quotas), revenue from employer subscriptions and add-ons.
- **Job Seeker Quotas**: Rolling 30-day quotas for metered actions (anchored to user signup date), with purchasable credit top-ups (FIFO expiring-first consumption). Application creation and entitlement consumption are wrapped in a single DB transaction. Shared fulfillment logic (`server/utils/fulfillTopUp.ts`) is used by both the Stripe webhook handler (primary, server-side) and the client-side success-page fallback endpoint.
- **Job Listings**: Support Markdown for descriptions; comprehensive job posts with internal/external apply options.
- **User Dashboards**: Role-specific dashboards for job seekers, employers, and administrators, providing relevant management and viewing capabilities.
- **Stripe Integration**: Manages employer subscriptions and one-time purchases, utilizing `stripe-replit-sync` for webhooks and data synchronization.
- **Resume Management**: Job seekers can create text-based resumes.
- **Blog and Resources**: Content management for blog posts and gated resource library.
- **Site Management**: Admin tools for managing site settings, custom pages, categories, and coupons, including a WCAG AA contrast-validated footer theme editor.
- **Employer Verification**: Multi-step verification system where employers submit evidence (DOT numbers, business licenses, etc.) for admin review. Schema: `employerVerificationRequests` + `employerEvidenceItems` tables; `verificationStatus` on `users`. Routes: `/api/employer/verification/*` (employer) and `/api/admin/employer-verification/*` (admin). Frontend: `VerificationPage.tsx` (employer) and `VerificationInbox.tsx` (admin dashboard).
- **Messaging System**: In-app 1-to-1 messaging between job seekers and employers. Schema: `conversations` (seekerId, employerId, jobId, lastMessageAt) + `messages` (conversationId, senderId, content, isRead). Routes: `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages`, `POST /api/conversations/:id/read`, `GET /api/conversations/unread-count`. Frontend: `Inbox.tsx` at `/dashboard/messages` (inbox list + thread view in one page). Entry points: "Message Employer" button on job detail page (only shown when employer is registered AND `verificationStatus === 'verified'`); "Message" button on each applicant row in the employer's Applicants tab. Email notification via Mailgun on new message (fire-and-forget, degrades gracefully). Unread count badge on sidebar Messages link, polled every 30 seconds. All conversations are initiated contextually — no free-form "New Message" compose.
- **Seeker Credential Verification**: Track-aware credential/license verification for job seekers. Schema: `seekerCredentialRequirements` (master credential catalog, 7 seeded), `seekerRequirementRules` (condition-based rules: track/job_tag), `seekerVerificationRequests` (with partial unique index), `seekerCredentialEvidenceItems` (linked to requirement key). Users table has `seekerTrack` and `seekerVerificationStatus` columns; jobs table has `tags text[]`. Requirements engine (`computeRequirements`) recommends credentials based on user track and applied job tags. Routes: `/api/seeker/verification/*` (seeker) and `/api/admin/seeker-verification/*` (admin). Frontend: `SeekerVerificationPage.tsx` (seeker, at `/seeker/settings/verification`) and `SeekerVerificationInbox.tsx` (admin dashboard, at `/dashboard/admin/seeker-verification`). Seed data runs at boot via `seedSeekerCredentialData()`.
- **Add-on Purchase Flow**: One-time payments for features like "Resume Access" and "Featured Employer."
- **Publish/Unpublish Flow**: `isPublished` boolean controls content visibility across all content types.
- **Social Publishing Module**: Admin module for creating, scheduling, and queuing social media posts via Zapier webhooks to platforms like LinkedIn, Facebook, and Instagram.
- **Resource Detail Pages**: Public routes for viewing detailed resource content.
- **Auth Modal**: Centralized login/signup modal accessible throughout the application, replacing dedicated authentication pages.
- **Image Uploads**: Handled via `POST /api/upload`, with Cloudflare R2 as the primary storage solution when configured, falling back to local disk otherwise.

## External Dependencies
- **Cloudflare R2**: Object storage for persistent image uploads.
- **Stripe**: Payment gateway for employer subscriptions and one-time purchases.
- **Mailgun**: Email service for sending notifications and contact form submissions.
- **Notion API**: Legacy integration for product/pricing data, now primarily a fallback.
- **Zapier Webhooks**: Used for automating social media posts.
- **Apify**: Web scraping platform used for automated Workday job imports. Requires `APIFY_TOKEN` env var.

## Apify Job Import Pipeline (Task #21)
The import pipeline automates scraping Workday job listings via Apify for transportation companies:

### Architecture
- **Database tables**: `job_sources` (scraper configurations), `import_targets` (discovered company domains), `job_import_runs` (run history/stats). Extended `jobs` table with `sourceId`, `importTargetId`, `externalJobId`, `sourceUrl`, `externalPostedAt`, `isRemote`, `status`, `importedAt`, `lastImportedAt`, `lastAdminEditedAt`, `rawSourceSnippet`.
- **Backend modules** (`server/import/`): `apifyClient.ts` (Apify API client), `tsvParser.ts` (TSV parsing via csv-parse), `fieldMapper.ts` (row-to-job field mapping with validation), `importOrchestrator.ts` (orchestration with anomaly detection, admin edit protection, expiry logic).
- **Admin API routes** (`server/adminImportRoutes.ts`): REST endpoints for managing sources, targets, and runs at `/api/admin/imports/*`.
- **Scheduler** (`server/index.ts`): 15-minute interval checking for sources due for polling. Seeds a default "Apify Workday Scraper" source (paused) on first run.
- **Admin UI** (`client/src/pages/dashboard/ImportManagement.tsx`): Three-tab interface (Sources, Discovered Companies, Run History) at `/dashboard/admin/imports`.

### Key Design Decisions
- New domains discovered by Apify start as `pending_review` — no jobs imported until admin activates.
- Anomaly guard: skips expiry for domains with 90%+ job count drop.
- Admin edit protection: title/description NOT overwritten if `lastAdminEditedAt` is set.
- `rawSourceSnippet`: first 2048 chars of JSON-stringified source row for debugging.
- `applyUrl` validated before storing; invalid rows skipped with warning.
- Imports use `employerId: 0` (no employer account linking for now).