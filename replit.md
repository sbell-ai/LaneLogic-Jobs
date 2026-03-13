# LaneLogic Jobs - Transportation Sector Job Board

## Overview
LaneLogic Jobs is a full-stack job board platform tailored for the transportation industry. It aims to connect job seekers and employers through a membership-based system, offering features like job listings, application management, a resource library, a blog, and comprehensive dashboards. The platform incorporates Stripe for subscription and add-on payments, and Mailgun for communication. The business vision is to become the leading specialized job platform in the transportation sector, providing a streamlined and efficient hiring process for an underserved market.

## User Preferences
I prefer that you prioritize the use of React with TypeScript, Tailwind CSS, and Shadcn UI for frontend development, ensuring a modern and responsive user interface. For the backend, stick to Express.js with TypeScript and PostgreSQL with Drizzle ORM. Please focus on implementing the Notion SOT Contract precisely for pricing and entitlement enforcement, as it is non-negotiable. Ensure that all development aligns with the established project structure and leverages shared configurations for consistency. When making changes, particularly to the core logic of the Notion SOT sync or Stripe integration, please explain the reasoning and impact thoroughly before proceeding.

## System Architecture

### UI/UX Decisions
The platform utilizes React with TypeScript, Wouter for routing, and a combination of Tailwind CSS and Shadcn UI for a consistent and modern design. Framer Motion is used for animations, enhancing user experience. Dashboards for different user roles (Job Seeker, Employer, Admin) share a common sidebar layout for navigation. Programmatic SEO pages are dynamically generated with templated content and meta tags for optimal search engine visibility.

### Technical Implementations
- **Frontend**: Built with React + TypeScript, employing TanStack Query for data fetching and state management.
- **Backend**: An Express.js server in TypeScript handles API requests, authentication, and integration with external services.
- **Database**: PostgreSQL is used as the primary data store, managed with Drizzle ORM for type-safe interactions.
- **Authentication**: Passport.js with a local strategy and session-based authentication manages user access.
- **Notion SOT Registry Sync**: A critical system that fetches, validates, and atomically promotes data from four Notion registries (Products & Pricing, Features & Entitlements, Product Entitlement Overrides, Compliance Rules) into Postgres snapshots. Runtime operations exclusively use these validated snapshots. The system is fail-closed, meaning if validation fails, the last-known-good snapshot is retained.
- **Entitlement Enforcement**: A runtime entitlement resolver, keyed by Stripe Price ID, enforces access based on the Notion-synced data. It is fail-closed, ensuring that missing overrides result in denied access (e.g., value=0 for Limits, enabled=false for Flags). Admin users and free users have specific bypass or default entitlement logic.
- **Programmatic SEO**: Generates dynamic job listing pages based on categories and states (e.g., `/jobs/cdl-jobs-texas`) with tiered keyword matching and dynamic SEO metadata. Legacy URLs are redirected.
- **Admin Bulk Job Import**: Allows administrators to upload job listings via CSV, supporting upserts, row-level validation, and error reporting. Required CSV columns: `externalJobKey`, `title`, `description`, `requirements`. Optional `experienceLevelYears` accepts only `0-2 | 2-5 | 5-10 | 10+` (invalid values skip row with `INVALID_EXPERIENCE_LEVEL`; legacy `experienceLevel` column aliased to `experienceLevelYears`). Skills/keywords stored as `rawSkills`/`rawKeywords` arrays in `job_metadata` JSONB. Tagging architecture stub (`server/taggingValidator.ts`) is disabled by default (`TAGGING_ARCH_ENABLED=false`); when enabled, validates keywords against canonical tags and rejects ambiguous mappings. CSV columns `category` and `subcategory` are validated against the job taxonomy (see below).
- **Job Category Taxonomy**: A fixed 2-level taxonomy of 15 categories with specific subcategories, defined as a canonical constant in `shared/jobTaxonomy.ts` (using `as const`). Validation rule: both `category` and `subcategory` may be null, but if either is set, both must be valid. `validateCategoryPair()` enforces this uniformly across create/update/bulk-update/CSV-import. The `categories` table (type="job") remains for backward compatibility but job forms/filters exclusively use the taxonomy. Admin has a "Missing category" filter option to review uncategorized jobs. One-time migration endpoint: `POST /api/admin/jobs/migrate-categories` maps legacy values using exact match + explicit legacy mapping table → null for unmapped values.

### Feature Specifications
- **Job Listings**: Comprehensive job posts with internal/external apply options. Job descriptions support Markdown rendering via `react-markdown` + `remark-gfm` (component: `client/src/components/MarkdownDescription.tsx`); raw HTML is disallowed; plain-text descriptions get a pretty-print fallback that converts common labels to headings.
- **Membership Gating**: Access to resources is restricted based on membership tiers.
- **User Dashboards**: Role-specific dashboards for job seekers (applications, resume, membership), employers (post jobs, manage jobs, applicants, CSV upload), and administrators. Admin sidebar has 8 top-level items: Users (with collapsible sub-items for Job Seeker Users and Employer Users), All Jobs (with Post a Job and Upload Jobs CSV buttons on page), Pages & Resources (landing page linking to Site Pages, Custom Pages, Resources), Blog Posts, Database (categories/industries), Coupons, Design Settings, Social Publishing. Routes: `/dashboard/admin/:section` and `/dashboard/admin/:section/:subsection`.
- **Stripe Integration**: Handles subscription-based memberships and one-time add-on purchases (Resume Access, Featured Employer). The system uses `stripe-replit-sync` for webhook management and database synchronization.
- **Resume Management**: Job seekers can create text-based resumes.
- **Blog and Resources**: Content management for blog posts and a member-gated resource library.
- **Site Management**: Admin tools for managing site settings, custom pages, categories, and coupons. Includes a **footer theme editor** (`DesignSettings.tsx`) with color pickers for footer background (+ opacity slider), text, link, and link-hover colors, plus page background. Live preview panel shows real-time appearance. All footer colors validated against WCAG AA contrast ratio (4.5:1) both client-side (inline badges) and server-side (PUT `/api/settings` returns 400 with `errors[]` on failure). Color utilities in `shared/colorUtils.ts`: `parseHex`, `normalizeHex`, `alphaBlend`, `contrastRatio`, `computeEffectiveBg`, `checkFooterContrast`. Footer component (`Footer.tsx`) applies colors via CSS custom properties set from settings.
- **Add-on Purchase Flow**: One-time payments for features like "Resume Access" (additive views, 365-day expiry) and "Featured Employer" (7-day window, extends on repurchase).
- **Publish/Unpublish Flow**: All content types (jobs, blog posts, resources, pages) have an `isPublished` boolean column. `isPublished === true` is the sole publish gate; `publishedAt` is metadata only. New items default to draft (`isPublished: false`). Public API endpoints filter by `isPublished` for non-admin users. Admin sees all content. Toggle is in each entity's edit Dialog in the admin dashboard.
- **Social Publishing Module**: Admin module for creating, scheduling, and queuing social media posts for jobs, blog posts, and resources via Zapier webhook. MVP platforms: LinkedIn, Facebook Page, Instagram Business.
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
- **Resource Detail Pages**: Public route `/resources/:id` with component `client/src/pages/ResourceDetail.tsx` and API endpoint `GET /api/resources/:id` (gated on `isPublished`).

## External Dependencies
- **Stripe**: For processing all payments, including subscriptions and one-time add-ons. It integrates with `stripe-replit-sync` for webhook handling and database synchronization.
- **Mailgun**: Utilized for sending emails, specifically for contact form submissions.
- **Notion API**: Used to retrieve and synchronize product, pricing, feature, entitlement, and compliance data into the application's database. This serves as the Source of Truth (SOT) for these configurations.
- **Zapier Webhooks**: Used for social media publishing. The app sends social post payloads to a Zapier webhook, which handles posting to LinkedIn, Facebook, and Instagram. Zapier reports results back via a secured callback endpoint.