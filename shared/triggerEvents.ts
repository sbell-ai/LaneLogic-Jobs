export type TriggerType = "event" | "scheduled" | "manual";

export interface TriggerEvent {
  key: string;
  label: string;
  description: string;
  type: TriggerType;
}

export const TRIGGER_EVENTS: TriggerEvent[] = [
  {
    key: "user_registered_seeker",
    label: "Job Seeker Registered",
    description: "Fires when a new job seeker creates an account.",
    type: "event",
  },
  {
    key: "user_registered_employer",
    label: "Employer Registered",
    description: "Fires when a new employer creates an account.",
    type: "event",
  },
  {
    key: "application_received",
    label: "Application Submitted",
    description: "Fires when a job seeker submits an application to a job.",
    type: "event",
  },
  {
    key: "application_status_changed",
    label: "Application Status Changed",
    description: "Fires when an employer updates the status of an application.",
    type: "event",
  },
  {
    key: "message_sent",
    label: "New Message Sent",
    description: "Fires when a message is sent between a seeker and an employer.",
    type: "event",
  },
  {
    key: "feature_expiring",
    label: "Feature / Plan Expiring (Scheduled)",
    description: "Fires on a daily schedule for users whose plan or feature is expiring soon. Requires a scheduler to be configured.",
    type: "scheduled",
  },
];

export function getTriggerEvent(key: string): TriggerEvent | undefined {
  return TRIGGER_EVENTS.find((e) => e.key === key);
}
