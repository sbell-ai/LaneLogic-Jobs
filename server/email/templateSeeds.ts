// server/email/templateSeeds.ts
// Default template definitions for all 6 system email templates.
// Used in server startup to upsert seeds via INSERT ... ON CONFLICT (slug) DO NOTHING.
// Each template includes a testVars map used by the Send Test endpoint.

export interface TemplateVariable {
  key: string;
  description: string;
}

export interface TemplateSeed {
  slug: string;
  name: string;
  subject: string;
  body: string;
  variables: TemplateVariable[];
  testVars: Record<string, string>;
  triggerType: "event" | "scheduled" | "manual";
  triggerEvent: string | null;
}

export const DEFAULT_TEMPLATES: TemplateSeed[] = [
  // ─────────────────────────────────────────────────────────────
  // USER LIFECYCLE
  // ─────────────────────────────────────────────────────────────
  {
    slug: "welcome_seeker",
    name: "Welcome – Job Seeker",
    subject: "Welcome to {{site_name}}, {{first_name}}!",
    body: `Hi {{first_name}},

Welcome to {{site_name}}! We're glad you're here.

Your account is all set up and ready to go. Start exploring job opportunities and take the next step in your career.

Visit your dashboard here:
{{dashboard_url}}

If you have any questions, just reply to this email — we're happy to help.

Best,
The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Seeker's first name" },
      { key: "last_name", description: "Seeker's last name" },
      { key: "email", description: "Seeker's email address" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Root URL of the platform" },
      { key: "dashboard_url", description: "Direct link to the seeker's dashboard" },
    ],
    testVars: {
      first_name: "Alex",
      last_name: "Rivera",
      email: "alex.rivera@example.com",
      site_name: "WorkBoard",
      site_url: "https://workboard.example.com",
      dashboard_url: "https://workboard.example.com/dashboard",
    },
    triggerType: "event",
    triggerEvent: "user_registered_seeker",
  },

  {
    slug: "welcome_employer",
    name: "Welcome – Employer",
    subject: "Welcome to {{site_name}}, {{first_name}}!",
    body: `Hi {{first_name}},

Welcome to {{site_name}}! Your employer account for {{company_name}} is ready.

You can now post jobs, review applications, and find your next great hire.

Get started here:
{{dashboard_url}}

Questions? Reply to this email anytime.

Best,
The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "company_name", description: "Employer's company name" },
      { key: "email", description: "Employer's email address" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Root URL of the platform" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
    ],
    testVars: {
      first_name: "Jordan",
      company_name: "Acme Corp",
      email: "jordan@acmecorp.example.com",
      site_name: "WorkBoard",
      site_url: "https://workboard.example.com",
      dashboard_url: "https://workboard.example.com/dashboard",
    },
    triggerType: "event",
    triggerEvent: "user_registered_employer",
  },

  // ─────────────────────────────────────────────────────────────
  // APPLICATIONS
  // ─────────────────────────────────────────────────────────────
  {
    slug: "application_status_changed",
    name: "Application Status Update",
    subject: "Update on your application for {{job_title}} at {{company_name}}",
    body: `Hi {{first_name}},

There's an update on your application for {{job_title}} at {{company_name}}.

Your application status has been changed to: {{status}}

Log in to view the full details:
{{dashboard_url}}

Good luck!

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Applicant's first name" },
      { key: "job_title", description: "Title of the job applied to" },
      { key: "company_name", description: "Name of the hiring company" },
      { key: "status", description: "New application status (e.g. Reviewed, Interview, Rejected)" },
      { key: "site_url", description: "Root URL of the platform" },
      { key: "dashboard_url", description: "Direct link to the applicant's dashboard" },
    ],
    testVars: {
      first_name: "Alex",
      job_title: "Senior Designer",
      company_name: "Acme Corp",
      status: "Interview Scheduled",
      site_url: "https://workboard.example.com",
      dashboard_url: "https://workboard.example.com/dashboard",
    },
    triggerType: "event",
    triggerEvent: "application_status_changed",
  },

  {
    slug: "application_received",
    name: "Application Confirmation",
    subject: "We received your application for {{job_title}} at {{company_name}}",
    body: `Hi {{first_name}},

Great news — your application for {{job_title}} at {{company_name}} has been received!

The employer will review your application and update you on next steps. You can track your application status in your dashboard:
{{dashboard_url}}

Best of luck!

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Applicant's first name" },
      { key: "job_title", description: "Title of the job applied to" },
      { key: "company_name", description: "Name of the hiring company" },
      { key: "site_url", description: "Root URL of the platform" },
      { key: "dashboard_url", description: "Direct link to the applicant's dashboard" },
    ],
    testVars: {
      first_name: "Alex",
      job_title: "Senior Designer",
      company_name: "Acme Corp",
      site_url: "https://workboard.example.com",
      dashboard_url: "https://workboard.example.com/dashboard",
    },
    triggerType: "event",
    triggerEvent: "application_received",
  },

  // ─────────────────────────────────────────────────────────────
  // MESSAGING
  // ─────────────────────────────────────────────────────────────
  {
    slug: "new_message",
    name: "New Inbox Message",
    subject: "{{sender_name}} sent you a message on {{site_name}}",
    body: `Hi {{first_name}},

You have a new message from {{sender_name}}:

---
{{message_preview}}
---

Reply in your inbox:
{{inbox_url}}

The {{site_name}} Team`,
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "sender_name", description: "Display name of the message sender" },
      { key: "message_preview", description: "First ~150 characters of the message" },
      { key: "inbox_url", description: "Direct link to the recipient's inbox" },
      { key: "site_name", description: "Your platform name" },
    ],
    testVars: {
      first_name: "Alex",
      sender_name: "Jordan at Acme Corp",
      message_preview: "Hi Alex, we reviewed your portfolio and would love to set up a quick call...",
      inbox_url: "https://workboard.example.com/inbox",
      site_name: "WorkBoard",
    },
    triggerType: "event",
    triggerEvent: "message_sent",
  },

  // ─────────────────────────────────────────────────────────────
  // AUTH & ACCOUNT
  // ─────────────────────────────────────────────────────────────
  {
    slug: "password_reset",
    name: "Password Reset",
    subject: "Reset your password",
    body: `Hi {{first_name}},

We received a request to reset the password for your account associated with this email address.

Click the link below to reset your password:
{{reset_link}}

This link expires in: {{expires_in}}.

If you didn't request a password reset, you can safely ignore this email — your password will not be changed and your account remains secure.

For security purposes, never share this link with anyone.

Thanks for using {{site_name}}!

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "reset_link", description: "The one-time password reset URL" },
      { key: "expires_in", description: "How long the link is valid (e.g. '1 hour')" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
    testVars: {
      first_name: "Alex",
      reset_link: "https://lanelogicjobs.com/reset-password?token=demo-token-123",
      expires_in: "1 hour",
      site_name: "LaneLogic Jobs",
      site_url: "https://lanelogicjobs.com",
    },
    triggerType: "event",
    triggerEvent: "password_reset",
  },

  {
    slug: "email_verification",
    name: "Email Verification",
    subject: "Verify your email address",
    body: `Hi {{first_name}},

Thanks for signing up! Please verify your email address by clicking the link below:

{{verification_link}}

This link is valid for {{expires_in}}.

If you didn't create an account, you can safely ignore this email.

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "verification_link", description: "The one-time email verification URL" },
      { key: "expires_in", description: "How long the link is valid (e.g. '7 days')" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
    testVars: {
      first_name: "Alex",
      verification_link: "https://lanelogicjobs.com/verify-email?token=demo-token-456",
      expires_in: "7 days",
      site_name: "LaneLogic Jobs",
      site_url: "https://lanelogicjobs.com",
    },
    triggerType: "event",
    triggerEvent: "email_verification",
  },

  // ─────────────────────────────────────────────────────────────
  // JOBS
  // ─────────────────────────────────────────────────────────────
  {
    slug: "job_posted",
    name: "Job Posted / Published",
    subject: "Your job listing \"{{job_title}}\" is now live on {{site_name}}",
    body: `Hi {{first_name}},

Great news — your job listing "{{job_title}}" at {{company_name}} is now live!

View it here:
{{job_url}}

Manage all your listings from your dashboard:
{{dashboard_url}}

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "company_name", description: "Employer's company name" },
      { key: "job_title", description: "Title of the job listing" },
      { key: "job_url", description: "Public URL of the job listing" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
    testVars: {
      first_name: "Jordan",
      company_name: "Acme Freight",
      job_title: "CDL A Driver – OTR",
      job_url: "https://lanelogicjobs.com/jobs/123",
      dashboard_url: "https://lanelogicjobs.com/dashboard",
      site_name: "LaneLogic Jobs",
      site_url: "https://lanelogicjobs.com",
    },
    triggerType: "event",
    triggerEvent: "job_posted",
  },

  // ─────────────────────────────────────────────────────────────
  // APPLICATIONS (ADDITIONAL)
  // ─────────────────────────────────────────────────────────────
  {
    slug: "application_withdrawn",
    name: "Application Withdrawn",
    subject: "{{seeker_name}} withdrew their application for {{job_title}}",
    body: `Hi {{first_name}},

{{seeker_name}} has withdrawn their application for the {{job_title}} position at {{company_name}}.

You can review your remaining applicants in your dashboard:
{{dashboard_url}}

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "seeker_name", description: "Name of the applicant who withdrew" },
      { key: "job_title", description: "Title of the job" },
      { key: "company_name", description: "Hiring company's name" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
      { key: "site_url", description: "Your platform URL" },
    ],
    testVars: {
      first_name: "Jordan",
      seeker_name: "Alex Rivera",
      job_title: "CDL A Driver – OTR",
      company_name: "Acme Freight",
      dashboard_url: "https://lanelogicjobs.com/dashboard",
      site_name: "LaneLogic Jobs",
      site_url: "https://lanelogicjobs.com",
    },
    triggerType: "event",
    triggerEvent: "application_withdrawn",
  },

  // ─────────────────────────────────────────────────────────────
  // SCHEDULED
  // ─────────────────────────────────────────────────────────────
  {
    slug: "account_expiring",
    name: "Account / Feature Expiring Soon",
    subject: "Your {{feature_name}} on {{site_name}} expires on {{expiry_date}}",
    body: `Hi {{first_name}},

Just a heads up — your {{feature_name}} is set to expire on {{expiry_date}}.

To continue without interruption, log in and review your account:
{{dashboard_url}}

If you have questions about your account, reply to this email.

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "User's first name" },
      { key: "feature_name", description: "Name of the feature or plan expiring" },
      { key: "expiry_date", description: "Human-readable expiry date (e.g. April 1, 2025)" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Root URL of the platform" },
      { key: "dashboard_url", description: "Direct link to the user's dashboard" },
    ],
    testVars: {
      first_name: "Alex",
      feature_name: "Premium Employer Plan",
      expiry_date: "April 1, 2025",
      site_name: "WorkBoard",
      site_url: "https://workboard.example.com",
      dashboard_url: "https://workboard.example.com/dashboard",
    },
    triggerType: "scheduled",
    triggerEvent: "feature_expiring",
  },

  // ─────────────────────────────────────────────────────────────
  // JOB EXPIRING (SCHEDULED)
  // ─────────────────────────────────────────────────────────────
  {
    slug: "job_expiring",
    name: "Job Listing Expiring Soon",
    subject: "Your job listing \"{{job_title}}\" expires on {{expiry_date}}",
    body: `Hi {{first_name}},

Your job listing "{{job_title}}" at {{company_name}} is set to expire on {{expiry_date}}.

To keep it live and attracting candidates, renew it from your dashboard:
{{renew_url}}

Need help? Just reply to this email.

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "company_name", description: "Employer's company name" },
      { key: "job_title", description: "Title of the expiring job listing" },
      { key: "expiry_date", description: "Human-readable expiry date (e.g. April 1, 2025)" },
      { key: "renew_url", description: "Link to renew or extend the listing" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Root URL of the platform" },
    ],
    testVars: {
      first_name: "Jordan",
      company_name: "Acme Freight",
      job_title: "CDL A Driver – OTR",
      expiry_date: "April 1, 2025",
      renew_url: "https://workboard.example.com/dashboard/jobs",
      dashboard_url: "https://workboard.example.com/dashboard",
      site_name: "WorkBoard",
      site_url: "https://workboard.example.com",
    },
    triggerType: "scheduled",
    triggerEvent: "job_expiring",
  },

  // ─────────────────────────────────────────────────────────────
  // INCOMPLETE PROFILE REMINDER (SCHEDULED)
  // ─────────────────────────────────────────────────────────────
  {
    slug: "profile_incomplete_reminder",
    name: "Complete Your Profile Reminder",
    subject: "Complete your {{site_name}} profile to stand out to employers",
    body: `Hi {{first_name}},

Your {{site_name}} profile is almost ready — just a few fields are missing:

{{missing_fields}}

A complete profile helps employers find you and increases your chances of being contacted for great opportunities.

Finish your profile here:
{{profile_url}}

The {{site_name}} Team
{{site_url}}`,
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "missing_fields", description: "Comma-separated list of incomplete profile fields" },
      { key: "profile_url", description: "Direct link to the user's profile edit page" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Root URL of the platform" },
    ],
    testVars: {
      first_name: "Alex",
      missing_fields: "First name, Last name, Job track / category",
      profile_url: "https://workboard.example.com/dashboard/profile",
      site_name: "WorkBoard",
      site_url: "https://workboard.example.com",
    },
    triggerType: "scheduled",
    triggerEvent: "profile_incomplete_reminder",
  },
];
