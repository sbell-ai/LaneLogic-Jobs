export type TriggerType = "event" | "scheduled" | "manual";

export interface TriggerEventVariable {
  key: string;
  description: string;
}

export interface TriggerEvent {
  key: string;
  label: string;
  description: string;
  type: TriggerType;
  variables: TriggerEventVariable[];
}

export const TRIGGER_EVENTS: TriggerEvent[] = [
  // ── Auth & Account ───────────────────────────────────────────────────────
  {
    key: "user_registered_seeker",
    label: "Job Seeker Registered",
    description: "Fires when a new job seeker creates an account.",
    type: "event",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "last_name", description: "Recipient's last name" },
      { key: "email", description: "Recipient's email address" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
      { key: "dashboard_url", description: "Direct link to the user's dashboard" },
    ],
  },
  {
    key: "user_registered_employer",
    label: "Employer Registered",
    description: "Fires when a new employer creates an account.",
    type: "event",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "last_name", description: "Recipient's last name" },
      { key: "email", description: "Recipient's email address" },
      { key: "company_name", description: "Employer's company name" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
      { key: "dashboard_url", description: "Direct link to the user's dashboard" },
    ],
  },
  {
    key: "email_verification",
    label: "Email Verification",
    description: "Fires after registration to verify the user's email address.",
    type: "event",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "verification_link", description: "The one-time email verification URL" },
      { key: "expires_in", description: "How long the link is valid (e.g. '24 hours')" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },
  {
    key: "password_reset",
    label: "Password Reset",
    description: "Fires when a user requests a password reset link.",
    type: "event",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "reset_link", description: "The one-time password reset URL" },
      { key: "expires_in", description: "How long the link is valid (e.g. '1 hour')" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },
  {
    key: "password_changed",
    label: "Password Changed",
    description: "Fires after a user successfully changes their password (security notice).",
    type: "event",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "changed_at", description: "Date and time the password was changed" },
      { key: "support_url", description: "Link to contact support if this was unexpected" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },

  // ── Applications ─────────────────────────────────────────────────────────
  {
    key: "application_received",
    label: "Application Submitted",
    description: "Fires when a job seeker submits an application to a job.",
    type: "event",
    variables: [
      { key: "first_name", description: "Applicant's first name" },
      { key: "job_title", description: "Title of the job applied for" },
      { key: "company_name", description: "Hiring company's name" },
      { key: "application_id", description: "Unique application ID" },
      { key: "site_url", description: "Your platform URL" },
      { key: "dashboard_url", description: "Direct link to the user's dashboard" },
    ],
  },
  {
    key: "application_status_changed",
    label: "Application Status Changed",
    description: "Fires when an employer updates the status of an application.",
    type: "event",
    variables: [
      { key: "first_name", description: "Applicant's first name" },
      { key: "job_title", description: "Title of the job applied for" },
      { key: "company_name", description: "Hiring company's name" },
      { key: "new_status", description: "The updated application status" },
      { key: "application_id", description: "Unique application ID" },
      { key: "site_url", description: "Your platform URL" },
      { key: "dashboard_url", description: "Direct link to the user's dashboard" },
    ],
  },
  {
    key: "application_withdrawn",
    label: "Application Withdrawn",
    description: "Fires when a job seeker withdraws an application.",
    type: "event",
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "seeker_name", description: "Name of the applicant who withdrew" },
      { key: "job_title", description: "Title of the job" },
      { key: "company_name", description: "Hiring company's name" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },

  // ── Messaging ────────────────────────────────────────────────────────────
  {
    key: "message_sent",
    label: "New Message Sent",
    description: "Fires when a message is sent between a seeker and an employer.",
    type: "event",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "sender_name", description: "Display name of the message sender" },
      { key: "message_preview", description: "First ~150 characters of the message" },
      { key: "inbox_url", description: "Direct link to the recipient's inbox" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },

  // ── Jobs ─────────────────────────────────────────────────────────────────
  {
    key: "job_posted",
    label: "Job Posted / Published",
    description: "Fires when an employer's job listing is published.",
    type: "event",
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "company_name", description: "Employer's company name" },
      { key: "job_title", description: "Title of the job listing" },
      { key: "job_url", description: "Public URL of the job listing" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },

  // ── Scheduled ────────────────────────────────────────────────────────────
  {
    key: "feature_expiring",
    label: "Feature / Plan Expiring (Scheduled)",
    description: "Fires on a daily schedule for users whose plan or feature is expiring soon. Requires a scheduler to be configured.",
    type: "scheduled",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "feature_name", description: "Name of the expiring feature or plan" },
      { key: "expiry_date", description: "Date the feature or plan expires" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
      { key: "dashboard_url", description: "Direct link to the user's dashboard" },
    ],
  },
  {
    key: "job_expiring",
    label: "Job Listing Expiring (Scheduled)",
    description: "Fires on a daily schedule when a job listing is about to expire. Requires a scheduler to be configured.",
    type: "scheduled",
    variables: [
      { key: "first_name", description: "Employer's first name" },
      { key: "company_name", description: "Employer's company name" },
      { key: "job_title", description: "Title of the expiring job listing" },
      { key: "expiry_date", description: "Date the listing expires" },
      { key: "renew_url", description: "Link to renew or extend the listing" },
      { key: "dashboard_url", description: "Direct link to the employer's dashboard" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },
  {
    key: "profile_incomplete_reminder",
    label: "Incomplete Profile Reminder (Scheduled)",
    description: "Fires on a schedule for job seekers who have not completed their profile.",
    type: "scheduled",
    variables: [
      { key: "first_name", description: "Recipient's first name" },
      { key: "missing_fields", description: "Comma-separated list of incomplete profile fields" },
      { key: "profile_url", description: "Direct link to the user's profile edit page" },
      { key: "site_name", description: "Your platform name" },
      { key: "site_url", description: "Your platform URL" },
    ],
  },
];

export function getTriggerEvent(key: string): TriggerEvent | undefined {
  return TRIGGER_EVENTS.find((e) => e.key === key);
}
