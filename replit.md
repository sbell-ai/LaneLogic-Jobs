# TranspoJobs - Transportation Sector Job Board

## Overview
A full-stack job board platform specifically for the transportation industry, featuring membership-based access for job seekers and employers, resource libraries, blog, dashboards, and Stripe payment integration.

## Tech Stack
- **Frontend**: React + TypeScript, Wouter routing, TanStack Query, Tailwind CSS, Shadcn UI, Framer Motion
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Passport.js (local strategy, session-based)
- **Payments**: Stripe (subscription-based memberships)
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
    Login.tsx          - Login page
    Register.tsx       - Registration page
    dashboard/
      DashboardLayout.tsx       - Shared sidebar layout for all dashboards
      Overview.tsx              - Default dashboard overview
      JobSeekerDashboard.tsx    - Applications, Resume, Membership tabs
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

## Stripe Integration
- Checkout sessions created at POST /api/payments/create-checkout-session
- Webhook handler at POST /api/payments/webhook
- Requires STRIPE_SECRET_KEY env var (set via Stripe integration)
- Optional STRIPE_WEBHOOK_SECRET for webhook verification

## Key Features
- Job listings with external/internal apply flows
- Resume creation (text-based)
- CSV bulk upload for jobs/candidates/employers
- Membership gating on resource library
- Blog with admin publishing
- Role-based dashboard routing
