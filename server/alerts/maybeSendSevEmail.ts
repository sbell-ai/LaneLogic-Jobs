import { shouldSendAlert } from "./shouldSendAlert";
import { sendAlertEmail } from "./sendAlertEmail";

export async function maybeSendSevEmail(args: {
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  environment: string;
  registryName: string;
  eventType: string;
  subject: string;
  bodyText: string;
}) {
  if (args.severity !== "SEV-1" && args.severity !== "SEV-2") return;

  const okToSend = await shouldSendAlert({
    environment: args.environment,
    registryName: args.registryName,
    eventType: args.eventType,
    withinMinutes: 15,
  });

  if (!okToSend) return;

  await sendAlertEmail({ subject: args.subject, text: args.bodyText });
}