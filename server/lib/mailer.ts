// Sprint 6 — Nodemailer wrapper. Lazy transporter init so production gets
// SMTP and dev/test falls back to console.log without env vars.
//
// Required env in production:
//   SMTP_USER  noreply@lanelogicjobs.com
//   SMTP_PASS  Google Workspace app password

import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    transporter = null;
  }
  return transporter;
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP not configured — would send: "${opts.subject}" → ${opts.to}`);
    return;
  }
  try {
    await t.sendMail({
      from: `"LaneLogics" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("[mailer] sendMail failed:", err);
  }
}
