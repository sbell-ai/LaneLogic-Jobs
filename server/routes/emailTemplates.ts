import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import { testEmailRateLimit } from "./helpers";

const router = Router();

// ── Email Template Admin Routes ──────────────────────────────────────────────
const adminOnly = (req: any, res: any, next: any) => {
  if (requireAdminSession(req, res)) next();
};

router.get("/api/admin/email-templates", adminOnly, async (_req, res) => {
  try {
    const templates = await storage.getEmailTemplates();
    const enriched = templates.map(t => ({
      ...t,
      hasActiveTrigger: !!(t.triggerEvent && t.triggerType === "event"),
    }));
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/email-templates", adminOnly, async (req, res) => {
  try {
    const { name, slug, subject } = req.body;
    if (!name || !slug) return res.status(400).json({ message: "name and slug are required" });
    const slugClean = String(slug).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const existing = await storage.getEmailTemplateBySlug(slugClean);
    if (existing) return res.status(409).json({ message: "A template with that slug already exists" });
    const created = await storage.upsertEmailTemplate(slugClean, {
      name: String(name),
      subject: String(subject || ""),
      body: "<p>Write your email body here. Use <strong>{{variables}}</strong> to personalise it.</p>",
      variables: [],
      isActive: false,
      triggerType: null,
      triggerEvent: null,
    });
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/trigger-events", adminOnly, async (_req, res) => {
  const { TRIGGER_EVENTS } = await import("../../shared/triggerEvents.ts");
  res.json(TRIGGER_EVENTS);
});

router.get("/api/admin/email-templates/:slug", adminOnly, async (req, res) => {
  try {
    const t = await storage.getEmailTemplateBySlug(req.params.slug);
    if (!t) return res.status(404).json({ message: "Template not found" });
    const { DEFAULT_TEMPLATES } = await import("../email/templateSeeds.ts");
    const seed = DEFAULT_TEMPLATES.find(s => s.slug === req.params.slug);
    res.json({ ...t, hasActiveTrigger: (seed as any)?.hasActiveTrigger ?? true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/api/admin/email-templates/:slug", adminOnly, async (req, res) => {
  try {
    const { subject, body, variables, isActive, triggerType, triggerEvent } = req.body;
    const updated = await storage.upsertEmailTemplate(req.params.slug, {
      ...(subject !== undefined ? { subject } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(variables !== undefined ? { variables } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(triggerType !== undefined ? { triggerType } : {}),
      ...(triggerEvent !== undefined ? { triggerEvent: triggerEvent || null } : {}),
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/email-templates/:slug/test", adminOnly, async (req, res) => {
  const adminId = (req.user as any).id;
  const last = testEmailRateLimit.get(adminId);
  if (last && Date.now() - last < 30_000) {
    return res.status(429).json({ message: "Please wait 30 seconds between test sends." });
  }
  try {
    const template = await storage.getEmailTemplateBySlug(req.params.slug);
    if (!template) return res.status(404).json({ message: "Template not found" });

    const { DEFAULT_TEMPLATES } = await import("../email/templateSeeds.ts");
    const seed = DEFAULT_TEMPLATES.find(s => s.slug === req.params.slug);
    const testVars = seed?.testVars ?? {};

    const { renderEmailTemplate } = await import("../email/templateEngine.ts");
    const rendered = renderEmailTemplate(template.subject, template.body, testVars);

    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey || !domain) {
      return res.status(500).json({ message: "Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN." });
    }
    const FormData = (await import("form-data")).default;
    const Mailgun = (await import("mailgun.js")).default;
    const mg = new Mailgun(FormData).client({ username: "api", key: apiKey });
    const fromName = process.env.MAILGUN_FROM_NAME || "LaneLogic Jobs";
    const fromEmail = process.env.MAILGUN_FROM_EMAIL || `no-reply@${domain}`;
    const isHtml = rendered.body.trimStart().startsWith("<");
    await mg.messages.create(domain, {
      from: `${fromName} <${fromEmail}>`,
      to: [(req.user as any).email],
      subject: `[TEST] ${rendered.subject}`,
      ...(isHtml ? { html: rendered.body } : { text: rendered.body }),
    });

    testEmailRateLimit.set(adminId, Date.now());
    res.json({ message: `Test email sent to ${(req.user as any).email}` });
  } catch (err: any) {
    console.error("[email] Test send error:", err);
    res.status(500).json({ message: err.message || "Test send failed" });
  }
});

export default router;
