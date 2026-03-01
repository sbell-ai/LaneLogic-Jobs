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
```
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
```

## User Roles
- **admin** - Full platform management (users, jobs, resources, blog)
- **employer** - Post jobs, view applicants, CSV bulk upload
- **job_seeker** - Browse jobs, apply, manage resumes

## Membership Tiers
- **free** - Basic access
- **basic** - Mid-tier features ($19/mo seekers, $79/mo employers)
- **premium** - Full access ($49/mo seekers, $199/mo employers)

## Seed Accounts (for testing)
- Admin: admin@transportjobs.com / password123
- Employer: employer@trucking.com / password123  
- Job Seeker: seeker@example.com / password123

## Stripe Integration (stripe-replit-sync)
- Uses `stripe-replit-sync` package for automatic webhook management and DB sync
- Stripe schema auto-created in PostgreSQL on startup via `runMigrations()`
- Webhook endpoint: POST /api/stripe/webhook (managed automatically)
- Checkout: POST /api/payments/create-checkout-session
- Customer portal: POST /api/payments/portal
- Publishable key: GET /api/payments/config
- Products seeded via `npx tsx server/seed-products.ts`

### Stripe Products Created (Sandbox)
- TranspoJobs Basic - Job Seeker: $19/mo
- TranspoJobs Premium - Job Seeker: $49/mo
- TranspoJobs Basic - Employer: $79/mo
- TranspoJobs Premium - Employer: $199/mo

### Files
- server/stripeClient.ts - Stripe client factory (reads credentials from Replit connectors API)
- server/webhookHandlers.ts - Webhook processor
- server/seed-products.ts - Script to create Stripe products

## Jobs Schema (key fields)
- `title`, `companyName`, `jobType` (Full-time/Part-time/Contract/Seasonal/Owner-Operator/Lease Purchase/Temporary)
- `locationCity`, `locationState`, `locationCountry` (split location fields, not a single string)
- `description`, `requirements`, `benefits`, `salary`
- `isExternalApply`, `applyUrl`

## Database Tables
- `users` - User accounts with role (admin/employer/job_seeker), membershipTier (free/basic/premium), employer profile fields (companyAddress, contactName, contactEmail, contactPhone, aboutCompany)
- `jobs` - Job listings with category, industry, jobType fields
- `applications` - Job applications linking seekers to jobs
- `resources` - Member resource library with targetAudience and requiredTier gating
- `blog_posts` - Blog posts with category field
- `resumes` - Text-based resumes for job seekers
- `site_settings` - Key-value site configuration (name, colors, fonts, login/signup page text)
- `categories` - Labels for jobs, industries, blogs (id, name, type: job/industry/blog)
- `coupons` - Promotional discount codes (code, discountType, discountValue, maxUses, currentUses, expiresAt, isActive, appliesTo)

## Key Features
- Job listings with external/internal apply flows, job type filter, category/industry filter, company name display
- Resume creation (text-based)
- CSV bulk upload for jobs (companyName, jobType, locationCity, locationState, locationCountry, benefits)
- Membership gating on resource library (separate employer/seeker tabs)
- Blog with admin publishing and categories
- Role-based dashboard routing
- Design settings: brand colors, fonts, logo (with size control: small/medium/large/x-large), announcements, footer background color, footer copy, social media links (X/LinkedIn/Facebook/Instagram/YouTube/TikTok) (live CSS variable injection)
- Admin Site Pages editor: customize login/signup page text, testimonials, background images, brand icon selection (truck/building/briefcase/mappin/shield/package/navigation/none)
- Categories & Labels system: job categories, industries, blog categories (admin CRUD)
- Coupon code system: create/edit/delete coupons with percent/fixed discount, max uses, expiry, tier targeting
- Pricing page coupon input with live discount preview
- Full CRUD for all admin entities: users (edit/view/delete with role/tier), jobs (edit/view/delete with categories), resources (edit/delete with audience/tier), blog posts (edit/delete with categories)
