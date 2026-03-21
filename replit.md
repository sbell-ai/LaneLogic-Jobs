# LaneLogic Jobs - Transportation & Logistics Job Board

## Overview
LaneLogic Jobs is a search-first job board for the transportation and logistics industry, connecting job seekers with relevant roles efficiently. The homepage serves as the primary search interface, offering instant job loading and infinite scroll. The platform generates revenue from employer subscriptions and premium placements, while job seekers use the service for free. Key features include a deep transportation taxonomy, rich company profiles, an industry-specific content library, programmatic SEO, and a social publishing pipeline. The project aims to be the leading niche job board in its sector.

## User Preferences
Prioritize React with TypeScript, Tailwind CSS, and Shadcn UI for frontend development, ensuring a modern, clean, search-first interface with minimal chrome and generous whitespace. For the backend, stick to Express.js with TypeScript and PostgreSQL with Drizzle ORM. The admin product management system (replacing Notion) is the source of truth for products, entitlements, and pricing — changes to the entitlement resolver or Stripe integration should be explained thoroughly before proceeding. Design direction: HiringCafe-inspired, niche-focused, search-first UX.

## System Architecture

### UI/UX Decisions
The frontend uses React, TypeScript, Wouter for routing, and Tailwind CSS with Shadcn UI, enhanced by Framer Motion for animations. The design is "search-first," integrating search functionalities and filters directly on the homepage. Authentication is managed via a modal overlay. User dashboards are role-specific (Job Seeker, Employer, Admin) with a consistent layout. Programmatic SEO pages are dynamically generated with templated content and metadata.

### Technical Implementations
- **Frontend**: React + TypeScript, with TanStack Query for data fetching.
- **Backend**: Express.js server in TypeScript for APIs and integrations.
- **Database**: PostgreSQL with Drizzle ORM.
- **Authentication**: Passport.js with session-based, modal authentication.
- **Admin Product Management**: Manages products, entitlements, and overrides as the authoritative source, including Stripe product/price auto-creation.
- **Entitlement Enforcement**: Runtime resolver based on Stripe Price ID.
- **AI Crawlability / GEO**: Enforces canonical host, `robots.txt` for AI bots, dynamic `sitemap.xml`, `<link rel="canonical">` implementation, and `llms.txt`.
- **Programmatic SEO**: Dynamic generation of job listing pages with tiered keyword matching and dynamic metadata.
- **Admin Bulk Job Import**: CSV-based job upload with validation.
- **Job Category Taxonomy**: A canonical 2-level taxonomy defined in `shared/jobTaxonomy.ts`.
- **Search-First Homepage**: Redesigned to immediately display search, filters, and infinite-scrolling job results.
- **Rich Company Profile Pages**: Dedicated company profiles with detailed information and job listings.
- **Pricing Model**: Free for job seekers; revenue from employer subscriptions and add-ons.
- **Job Seeker Quotas**: Rolling 30-day quotas for metered actions, with purchasable credit top-ups.
- **Job Listings**: Supports Markdown, internal/external apply options.
- **User Dashboards**: Role-specific dashboards for management and viewing.
- **Stripe Integration**: Manages subscriptions and purchases.
- **Resume Management**: Text-based resume creation for job seekers.
- **Blog and Resources**: Content management for a blog and gated resources.
- **Site Management**: Admin tools for settings, custom pages, categories, and coupons.
- **Employer Verification**: Multi-step verification system for employers.
- **Messaging System**: In-app 1-to-1 messaging between job seekers and employers, with email notifications.
- **Seeker Credential Verification**: Track-aware credential/license verification for job seekers.
- **Add-on Purchase Flow**: One-time payments for specific features.
- **Publish/Unpublish Flow**: `isPublished` flag controls content visibility.
- **Social Publishing Module**: Admin module for scheduling social media posts via Zapier.
- **Resource Detail Pages**: Public routes for resource content.
- **Auth Modal**: Centralized login/signup modal.
- **Image Uploads**: Handled via `POST /api/upload`, primarily using Cloudflare R2.
- **Dynamic Cron Email Engine**: Database-driven engine for scheduled emails, configurable via admin UI, replacing hard-coded cron jobs. Includes security measures for SQL generation.
- **Email Templates System**: Admin dashboard for managing transactional email templates with a rendering engine, seeding of default templates, and admin CRUD routes.
- **Apify Job Import Pipeline**: Automates scraping Workday job listings via Apify, including scraper configurations, target management, run history, and field mapping.

## External Dependencies
- **Cloudflare R2**: Object storage for image uploads.
- **Stripe**: Payment gateway.
- **Mailgun**: Email service.
- **Notion API**: Legacy integration for product/pricing data.
- **Zapier Webhooks**: For social media automation.
- **Apify**: Web scraping platform for job imports.