// server/email/sendTemplatedEmail.ts
// Sends transactional emails via Mailgun using stored templates.
// Two entry points:
//   sendTemplatedEmail(slug, ...)       — fire by template slug (used by test endpoint)
//   sendTemplatedEmailByEvent(event, .) — fire by trigger event key (used by routes)
// Both are fire-and-forget safe: never throw — log failures silently.

import FormData from "form-data";
import Mailgun from "mailgun.js";
import { storage } from "../storage";
import { renderEmailTemplate, TemplateVars } from "./templateEngine";

const mailgun = new Mailgun(FormData);

function getMailgunClient() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromName = process.env.MAILGUN_FROM_NAME || "LaneLogic Jobs";
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `no-reply@${domain}`;

  if (!apiKey || !domain) return null;

  return {
    client: mailgun.client({ username: "api", key: apiKey }),
    domain,
    from: `${fromName} <${fromEmail}>`,
  };
}

async function dispatchEmail(template: { subject: string; body: string; isActive: boolean }, label: string, toEmail: string, vars: TemplateVars): Promise<void> {
  const mg = getMailgunClient();
  if (!mg) {
    console.warn(`[email] Mailgun not configured — skipping send for ${label}`);
    return;
  }
  if (!template.isActive) {
    console.info(`[email] Template inactive — skipping: ${label}`);
    return;
  }
  const { subject, body } = renderEmailTemplate(template.subject, template.body, vars);
  const isHtml = body.trimStart().startsWith("<");
  await mg.client.messages.create(mg.domain, {
    from: mg.from,
    to: [toEmail],
    subject,
    ...(isHtml ? { html: body } : { text: body }),
  });
  console.info(`[email] Sent ${label} to="${toEmail}"`);
}

/**
 * Sends a transactional email using the stored template identified by slug.
 * Used by the admin "Send Test" endpoint.
 */
export async function sendTemplatedEmail(slug: string, toEmail: string, vars: TemplateVars): Promise<void> {
  try {
    const template = await storage.getEmailTemplateBySlug(slug);
    if (!template) {
      console.warn(`[email] Template not found: slug="${slug}"`);
      return;
    }
    await dispatchEmail(template, `slug="${slug}"`, toEmail, vars);
  } catch (err) {
    console.error(`[email] Failed to send slug="${slug}" to="${toEmail}":`, err);
  }
}

/**
 * Sends a transactional email by looking up the active template assigned to a trigger event.
 * This is the preferred call site for all automatic system emails.
 * If no active template is assigned to the event, the send is silently skipped.
 */
export async function sendTemplatedEmailByEvent(triggerEvent: string, toEmail: string, vars: TemplateVars): Promise<void> {
  try {
    const templates = await storage.getEmailTemplates();
    const template = templates.find(t => t.triggerEvent === triggerEvent && t.isActive);
    if (!template) {
      console.warn(`[email] No active template for event="${triggerEvent}" — skipping`);
      return;
    }
    await dispatchEmail(template, `event="${triggerEvent}"`, toEmail, vars);
  } catch (err) {
    console.error(`[email] Failed to send event="${triggerEvent}" to="${toEmail}":`, err);
  }
}
