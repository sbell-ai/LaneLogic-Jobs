// Sprint 6 — Send wrappers that combine dedup + template + transport.
// Importing from these ensures every notification path goes through the
// dedup log.

import { sendEmail } from "./mailer";
import { checkAndLogEmail } from "./emailDedup";
import {
  buildExpiryWarningEmail,
  buildNewApplicantEmail,
  buildNewMatchEmail,
  type ExpiryWarningEmailVars,
  type NewApplicantEmailVars,
  type NewMatchEmailVars,
} from "./emailTemplates";

function siteUrl(): string {
  return process.env.CANONICAL_HOST || "https://lanelogicjobs.com";
}

// ─── new_match ───────────────────────────────────────────────────────────────

export async function sendNewMatchEmail(opts: {
  userId: number;
  to: string;
  jobId: number;
  vars: Omit<NewMatchEmailVars, "matchUrl">;
}): Promise<void> {
  const ok = await checkAndLogEmail(opts.userId, "new_match", `job_${opts.jobId}`);
  if (!ok) return;
  const { subject, html } = buildNewMatchEmail({
    ...opts.vars,
    matchUrl: `${siteUrl()}/matches`,
  });
  await sendEmail({ to: opts.to, subject, html });
}

// ─── expiry_warning ──────────────────────────────────────────────────────────

export async function sendExpiryWarningEmail(opts: {
  userId: number;
  to: string;
  credentialCode: string;
  expiryYearMonth: string; // e.g. "2026-07"
  vars: Omit<ExpiryWarningEmailVars, "profileUrl">;
}): Promise<void> {
  const ref = `${opts.credentialCode}_${opts.expiryYearMonth}`;
  const ok = await checkAndLogEmail(opts.userId, "expiry_warning", ref);
  if (!ok) return;
  const { subject, html } = buildExpiryWarningEmail({
    ...opts.vars,
    profileUrl: `${siteUrl()}/seeker/settings/cert-profile`,
  });
  await sendEmail({ to: opts.to, subject, html });
}

// ─── new_applicant — TODO: wire when application flow lands ──────────────────
// Scaffolded so the trigger is one edit away when applications ship.

export async function sendNewApplicantEmail(opts: {
  userId: number;
  to: string;
  applicationId: number;
  vars: Omit<NewApplicantEmailVars, "applicationUrl">;
}): Promise<void> {
  const ok = await checkAndLogEmail(opts.userId, "new_applicant", String(opts.applicationId));
  if (!ok) return;
  const { subject, html } = buildNewApplicantEmail({
    ...opts.vars,
    applicationUrl: `${siteUrl()}/dashboard/applicants`,
  });
  await sendEmail({ to: opts.to, subject, html });
}
