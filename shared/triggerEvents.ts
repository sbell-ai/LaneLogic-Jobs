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
];

export function getTriggerEvent(key: string): TriggerEvent | undefined {
  return TRIGGER_EVENTS.find((e) => e.key === key);
}
