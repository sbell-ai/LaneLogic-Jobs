// server/email/sendTemplatedEmail.ts
// Loads a template by slug, renders it, and sends via Mailgun.
// Fire-and-forget safe: never throws — logs failures silently.

import FormData from "form-data";
import Mailgun from "mailgun.js";
import { storage } from "../storage"; // adjust import to your actual path
import { renderEmailTemplate, TemplateVars } from "./templateEngine";

const mailgun = new Mailgun(FormData);

function getMailgunClient() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromName = process.env.MAILGUN_FROM_NAME || "WorkBoard";
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `no-reply@${domain}`;

  if (!apiKey || !domain) return null;

  return {
    client: mailgun.client({ username: "api", key: apiKey }),
    domain,
    from: `${fromName} <${fromEmail}>`,
  };
}

/**
 * Sends a transactional email using the stored template identified by slug.
 *
 * - If the template is inactive, logs and returns without sending.
 * - If Mailgun is not configured, logs and returns without throwing.
 * - Never throws — safe to call fire-and-forget.
 *
 * @param slug       Template slug (e.g. "welcome_seeker")
 * @param toEmail    Recipient email address
 * @param vars       Variable map for token replacement
 */
export async function sendTemplatedEmail(
  slug: string,
  toEmail: string,
  vars: TemplateVars
): Promise<void> {
  try {
    const mg = getMailgunClient();
    if (!mg) {
      console.warn(`[email] Mailgun not configured — skipping send for slug="${slug}"`);
      return;
    }

    const template = await storage.getEmailTemplateBySlug(slug);
    if (!template) {
      console.warn(`[email] Template not found: slug="${slug}"`);
      return;
    }

    if (!template.isActive) {
      console.info(`[email] Template inactive — skipping: slug="${slug}"`);
      return;
    }

    const { subject, body } = renderEmailTemplate(template.subject, template.body, vars);

    await mg.client.messages.create(mg.domain, {
      from: mg.from,
      to: [toEmail],
      subject,
      text: body,
    });

    console.info(`[email] Sent slug="${slug}" to="${toEmail}"`);
  } catch (err) {
    // Log but never propagate — email failures must not break calling routes
    console.error(`[email] Failed to send slug="${slug}" to="${toEmail}":`, err);
  }
}
