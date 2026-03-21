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
  // SCHEDULED (no active trigger yet — warn admin in UI)
  // ─────────────────────────────────────────────────────────────
  {
    slug: "account_expiring",
    name: "Account / Feature Expiring Soon",
    subject: "Your {{feature_name}} on {{site_name}} expires on {{expiry_date}}",
    body: `Hi {{first_name}},

Just a heads up — your {{feature_name}} is set to expire on {{expiry_date}}.

To continue without interruption, log in and review your account:
{{site_url}}

If you have questions about your account, reply to this email.

The {{site_name}} Team`,
    variables: [
      { key: "first_name", description: "User's first name" },
      { key: "feature_name", description: "Name of the feature or plan expiring" },
      { key: "expiry_date", description: "Human-readable expiry date (e.g. April 1, 2025)" },
      { key: "site_url", description: "Root URL of the platform" },
    ],
    testVars: {
      first_name: "Alex",
      feature_name: "Premium Employer Plan",
      expiry_date: "April 1, 2025",
      site_url: "https://workboard.example.com",
    },
    triggerType: "scheduled",
    triggerEvent: "feature_expiring",
  },
];
