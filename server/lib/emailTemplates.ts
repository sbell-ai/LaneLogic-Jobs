// Sprint 6 — Plain-HTML email templates. No template engine. Each builder
// returns { subject, html } so the mailer wrapper can stay trivial.
//
// Style notes:
//   - LaneLogics wordmark rendered as plain text (no images — keeps deliverable
//     across mail clients without external assets).
//   - Single-column layout, one CTA per email, no tracking pixels.

const WORDMARK = `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 24px;">LaneLogic <span style="color:#3b82f6;">Jobs</span></div>`;

const FOOTER = `<p style="font-size: 12px; color: #6b7280; margin-top: 32px;">Reply STOP to opt out of these notifications.</p>`;

const wrap = (innerHtml: string) => `<!doctype html>
<html><body style="margin:0; padding:24px; background:#f9fafb; font-family: 'Helvetica Neue', Arial, sans-serif; color: #111827;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
    ${WORDMARK}
    ${innerHtml}
    ${FOOTER}
  </div>
</body></html>`;

const button = (label: string, url: string) =>
  `<a href="${url}" style="display:inline-block; background:#3b82f6; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:600; font-size:14px; margin-top:16px;">${label}</a>`;

// ─── new_match ─────────────────────────────────────────────────────────────

export type NewMatchEmailVars = {
  firstName: string | null;
  jobTitle: string;
  employerName: string | null;
  jobLocation: string | null;
  score: number;
  topMetCredential: string | null;
  matchUrl: string; // typically `${siteUrl}/matches`
};

export function buildNewMatchEmail(v: NewMatchEmailVars): { subject: string; html: string } {
  const greeting = v.firstName ? `Hi ${v.firstName},` : "Hi,";
  const meta = [v.employerName, v.jobLocation].filter(Boolean).join(" · ");
  const credLine = v.topMetCredential
    ? `<p style="margin: 8px 0; color: #047857;">✓ ${v.topMetCredential}</p>`
    : "";
  const html = wrap(`
    <p>${greeting}</p>
    <p>You have a strong match on LaneLogics:</p>
    <h2 style="font-size: 18px; margin: 16px 0 4px;">${v.jobTitle}</h2>
    <p style="color: #6b7280; margin: 0 0 12px;">${meta}</p>
    <p style="font-size: 22px; font-weight: 700; color: #047857; margin: 12px 0;">${v.score}% match</p>
    ${credLine}
    ${button("View Match →", v.matchUrl)}
  `);
  return { subject: "You have a strong match on LaneLogics", html };
}

// ─── expiry_warning ─────────────────────────────────────────────────────────

export type ExpiryWarningEmailVars = {
  firstName: string | null;
  credentialName: string;
  expiryDate: string; // formatted display date
  profileUrl: string; // typically `${siteUrl}/seeker/settings/cert-profile`
};

export function buildExpiryWarningEmail(v: ExpiryWarningEmailVars): { subject: string; html: string } {
  const greeting = v.firstName ? `Hi ${v.firstName},` : "Hi,";
  const html = wrap(`
    <p>${greeting}</p>
    <p>Your <strong>${v.credentialName}</strong> expires on <strong>${v.expiryDate}</strong>.</p>
    <p>Keeping your credentials current improves your match scores.</p>
    ${button("Update Profile →", v.profileUrl)}
  `);
  return {
    subject: `Your ${v.credentialName} expires soon`,
    html,
  };
}

// ─── new_applicant (placeholder — TODO: wire when application flow lands) ───

export type NewApplicantEmailVars = {
  employerFirstName: string | null;
  applicantName: string;
  jobTitle: string;
  applicationUrl: string;
};

export function buildNewApplicantEmail(v: NewApplicantEmailVars): { subject: string; html: string } {
  const greeting = v.employerFirstName ? `Hi ${v.employerFirstName},` : "Hi,";
  const html = wrap(`
    <p>${greeting}</p>
    <p><strong>${v.applicantName}</strong> applied to your job:</p>
    <h2 style="font-size: 18px; margin: 16px 0 4px;">${v.jobTitle}</h2>
    ${button("Review Application →", v.applicationUrl)}
  `);
  return { subject: `New applicant for ${v.jobTitle}`, html };
}
