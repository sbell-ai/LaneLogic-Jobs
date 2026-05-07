import { Router } from "express";
import { storage } from "../storage";
import { pool } from "../db";
import { insertEmailCronConfigSchema } from "@shared/schema";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import { testEmailRateLimit } from "./helpers";

const router = Router();

const adminOnly = (req: any, res: any, next: any) => {
  if (requireAdminSession(req, res)) next();
};

// ── Email Cron Configs ────────────────────────────────────────────────────

// Shared whitelist constants (mirrors server/cron/scheduledEmails.ts)
const CRON_ALLOWED_TABLES = new Set(["users", "jobs", "applications"]);
const CRON_ALLOWED_FIELDS: Record<string, Set<string>> = {
  users: new Set([
    "id", "email", "first_name", "last_name", "role", "company_name",
    "created_at", "resume_access_expires_at", "featured_employer_expires_at",
    "seeker_track", "is_active",
  ]),
  jobs: new Set([
    "id", "employer_id", "title", "company_name", "expires_at",
    "created_at", "is_published", "status", "category",
  ]),
  applications: new Set([
    "id", "job_id", "job_seeker_id", "employer_id", "status", "created_at",
  ]),
};
const CRON_JOIN_BLOCKLIST = /\b(DROP|DELETE|UPDATE|INSERT|EXEC|UNION|ALTER|TRUNCATE)\b|;|--|\*\/|\/\*/i;

function validateCronRecipientJoin(joinStr: string | null | undefined): string | null {
  if (!joinStr) return null;
  if (CRON_JOIN_BLOCKLIST.test(joinStr)) return "recipient_join contains a blocked SQL keyword";
  // Validate every JOIN target in the string (handles multiple JOINs)
  const joinMatches = Array.from(joinStr.matchAll(/\bJOIN\s+(\w+)/gi));
  for (const m of joinMatches) {
    if (!CRON_ALLOWED_TABLES.has(m[1].toLowerCase())) {
      return `Join target "${m[1]}" is not in the allowed tables list`;
    }
  }
  return null;
}

router.get("/api/admin/email-cron-configs/schema", adminOnly, (_req, res) => {
  const allowedFields: Record<string, string[]> = {};
  for (const [table, fields] of Object.entries(CRON_ALLOWED_FIELDS)) {
    allowedFields[table] = Array.from(fields);
  }
  res.json({
    allowedTables: Array.from(CRON_ALLOWED_TABLES),
    allowedFields,
  });
});

router.get("/api/admin/email-cron-configs", adminOnly, async (_req, res) => {
  try {
    const configs = await storage.getEmailCronConfigs();
    res.json(configs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/api/admin/email-cron-configs/:id", adminOnly, async (req, res) => {
  try {
    const config = await storage.getEmailCronConfig(Number(req.params.id));
    if (!config) return res.status(404).json({ message: "Not found" });
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/email-cron-configs", adminOnly, async (req, res) => {
  try {
    const parsed = insertEmailCronConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const joinErr = validateCronRecipientJoin((parsed.data as any).recipientJoin);
    if (joinErr) return res.status(400).json({ message: joinErr });
    const config = await storage.createEmailCronConfig(parsed.data);
    res.status(201).json(config);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/api/admin/email-cron-configs/:id", adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertEmailCronConfigSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const joinErr = validateCronRecipientJoin((parsed.data as any).recipientJoin);
    if (joinErr) return res.status(400).json({ message: joinErr });
    const config = await storage.updateEmailCronConfig(id, parsed.data);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/admin/email-cron-configs/:id", adminOnly, async (req, res) => {
  try {
    await storage.deleteEmailCronConfig(Number(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/api/admin/email-cron-configs/:id/toggle", adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await storage.getEmailCronConfig(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const updated = await storage.updateEmailCronConfig(id, { isActive: !existing.isActive });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/api/admin/email-cron-configs/:id/test", adminOnly, async (req, res) => {
  const adminId = (req.user as any).id;
  const last = testEmailRateLimit.get(adminId);
  if (last && Date.now() - last < 30_000) {
    return res.status(429).json({ message: "Please wait 30 seconds between test sends." });
  }
  try {
    const config = await storage.getEmailCronConfig(Number(req.params.id));
    if (!config) return res.status(404).json({ message: "Config not found" });

    const template = await storage.getEmailTemplateBySlug(
      (await storage.getEmailTemplates()).find(t => t.id === config.templateId)?.slug ?? ""
    );
    if (!template) return res.status(404).json({ message: "Associated template not found" });

    const { DEFAULT_TEMPLATES } = await import("../email/templateSeeds.ts");
    const seed = DEFAULT_TEMPLATES.find(s => s.slug === template.slug);
    const fallbackVars: Record<string, string> = (seed?.testVars as Record<string, string>) ?? {};

    let liveVars: Record<string, string> | null = null;
    let dataSource: "live_data" | "sample_data" = "sample_data";
    let liveQueryError: string | null = null;

    if (CRON_ALLOWED_TABLES.has(config.sourceTable)) {
      const join = config.recipientJoin ?? "";
      const joinErr = validateCronRecipientJoin(join);
      if (joinErr) {
        liveQueryError = joinErr;
      } else {
        // Validate trigger field
        const bareField = config.triggerField.includes(".")
          ? config.triggerField.split(".").pop()!
          : config.triggerField;
        if (!CRON_ALLOWED_FIELDS[config.sourceTable]?.has(bareField)) {
          liveQueryError = `Trigger field "${config.triggerField}" is not in the allowed list`;
        } else {
          try {
            const joinedTable = join ? join.match(/\bJOIN\s+(\w+)/i)?.[1] : null;
            const selectCols = joinedTable
              ? `${config.sourceTable}.*, ${joinedTable}.*`
              : `${config.sourceTable}.*`;
            const offsetDays = Number(config.triggerOffsetDays) || 0;
            const intervalExpr = config.triggerDirection === "before"
              ? `CURRENT_DATE + INTERVAL '${offsetDays} days'`
              : `CURRENT_DATE - INTERVAL '${offsetDays} days'`;

            const params: unknown[] = [];
            const whereParts: string[] = [
              `${config.sourceTable}.${bareField}::date = ${intervalExpr}`,
            ];
            const safeBoolOps = new Set(["=", "!=", ">", "<", ">=", "<="]);
            for (const cond of (config.filterConditions ?? []) as Array<{ field: string; operator: string; value: string }>) {
              const col = cond.field.includes(".") ? cond.field.split(".").pop()! : cond.field;
              if (!CRON_ALLOWED_FIELDS[config.sourceTable]?.has(col)) continue;
              if (cond.operator === "IS NULL") {
                whereParts.push(`${config.sourceTable}.${col} IS NULL`);
              } else if (cond.operator === "IS NOT NULL") {
                whereParts.push(`${config.sourceTable}.${col} IS NOT NULL`);
              } else {
                const op = safeBoolOps.has(cond.operator) ? cond.operator : "=";
                params.push(cond.value);
                whereParts.push(`${config.sourceTable}.${col} ${op} $${params.length}`);
              }
            }

            const qResult = await pool.query(
              `SELECT ${selectCols} FROM ${config.sourceTable} ${join} WHERE ${whereParts.join(" AND ")} LIMIT 1`,
              params
            );

            if (qResult.rows.length > 0) {
              const row = qResult.rows[0];
              const vars: Record<string, string> = {
                site_name: "LaneLogic Jobs",
                site_url: process.env.CANONICAL_HOST || "https://lanelogicjobs.com",
                dashboard_url: `${process.env.CANONICAL_HOST || "https://lanelogicjobs.com"}/dashboard`,
              };
              for (const [token, mapping] of Object.entries(config.variableMappings ?? {})) {
                if (typeof mapping === "string" && mapping.startsWith("literal:")) {
                  vars[token] = mapping.slice("literal:".length);
                } else {
                  const col = String(mapping).split(".").pop() ?? String(mapping);
                  const colVal = row[col];
                  vars[token] = colVal instanceof Date
                    ? colVal.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                    : String(colVal ?? "");
                }
              }
              liveVars = vars;
              dataSource = "live_data";
            }
          } catch (err: any) {
            console.warn(`[cron-config] Live query failed for config id=${config.id}:`, err?.message);
            liveQueryError = err?.message ?? "Live query failed";
          }
        }
      }
    }

    const variablesUsed = liveVars ?? fallbackVars;

    const { renderEmailTemplate } = await import("../email/templateEngine.ts");
    const rendered = renderEmailTemplate(template.subject, template.body, variablesUsed);

    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey || !domain) {
      return res.status(500).json({ message: "Mailgun is not configured." });
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
    res.json({
      message: `Test email sent to ${(req.user as any).email}`,
      source: dataSource,
      variablesUsed,
      ...(liveQueryError ? { liveQueryWarning: liveQueryError } : {}),
    });
  } catch (err: any) {
    console.error("[cron-config] Test send error:", err);
    res.status(500).json({ message: err.message || "Test send failed" });
  }
});

export default router;
