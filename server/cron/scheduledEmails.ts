/**
 * Dynamic Cron Email Engine — Task #45
 *
 * Replaces three hard-coded nightly jobs with a database-driven engine.
 * Every 15 minutes the scheduler wakes up, loads all active EmailCronConfig
 * rows, and fires any config whose run_time (UTC HH:MM) matches the current
 * UTC hour:minute AND whose last_run_at is not today (UTC).
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 * Table names and column names come from the DB config rows. They are validated
 * against ALLOWED_TABLES / ALLOWED_FIELDS before any SQL interpolation.
 * The recipient_join string is checked against a blocklist of dangerous SQL
 * keywords and the JOIN target table must be in ALLOWED_TABLES.
 * Filter condition VALUES are passed as $N positional params (never interpolated)
 * via pool.query(), so they cannot cause SQL injection.
 *
 * ─── variable_mappings ────────────────────────────────────────────────────────
 * Map template token names → DB column names.
 * Values starting with "literal:" are passed as static strings,
 * e.g. { feature_name: "literal:Resume Access" }.
 * The engine auto-injects site_name, site_url, dashboard_url constants.
 *
 * ─── Legacy jobs (preserved as comments for reference) ────────────────────────
 */

import { pool } from "../db";
import { storage } from "../storage";
import type { EmailCronConfig } from "@shared/schema";
import { sendTemplatedEmailByEvent } from "../email/sendTemplatedEmail.ts";

// ── Constants ─────────────────────────────────────────────────────────────────
const SITE_NAME = "LaneLogic Jobs";
const SITE_URL = process.env.CANONICAL_HOST || "https://lanelogicjobs.com";

// ── Whitelists ────────────────────────────────────────────────────────────────
const ALLOWED_TABLES = new Set(["users", "jobs", "applications"]);

const ALLOWED_FIELDS: Record<string, Set<string>> = {
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

const JOIN_BLOCKLIST = /\b(DROP|DELETE|UPDATE|INSERT|EXEC|UNION|ALTER|TRUNCATE)\b|;|--|\*\/|\/\*/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the bare column name (strips table prefix if any) */
function bare(field: string): string {
  return field.includes(".") ? field.split(".").pop()! : field;
}

function isAllowedField(table: string, field: string): boolean {
  return ALLOWED_FIELDS[table]?.has(bare(field)) ?? false;
}

function validateJoin(joinStr: string): void {
  if (JOIN_BLOCKLIST.test(joinStr)) {
    throw new Error(`Blocked keyword in recipient_join`);
  }
  // Validate every JOIN target (handles multiple JOINs)
  const joinMatches = Array.from(joinStr.matchAll(/\bJOIN\s+(\w+)/gi));
  for (const m of joinMatches) {
    if (!ALLOWED_TABLES.has(m[1].toLowerCase())) {
      throw new Error(`Join target "${m[1]}" not in ALLOWED_TABLES`);
    }
  }
}

function formatDateValue(val: unknown): string {
  if (val instanceof Date) {
    return val.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
  }
  return String(val ?? "");
}

// ── Per-config runner ─────────────────────────────────────────────────────────

async function runConfig(config: EmailCronConfig): Promise<{ sent: number; errors: number }> {
  const { sourceTable, triggerField, triggerOffsetDays, triggerDirection,
          recipientField, recipientJoin, filterConditions, variableMappings,
          templateId } = config;

  // Validate table
  if (!ALLOWED_TABLES.has(sourceTable)) {
    throw new Error(`Blocked table "${sourceTable}" in config id=${config.id}`);
  }

  // Validate trigger field
  if (!isAllowedField(sourceTable, triggerField)) {
    throw new Error(`Blocked field "${triggerField}" on "${sourceTable}" in config id=${config.id}`);
  }

  // Validate join
  if (recipientJoin) validateJoin(recipientJoin);

  // Determine date expression
  const offsetDays = Number(triggerOffsetDays) || 0;
  const intervalExpr = triggerDirection === "before"
    ? `CURRENT_DATE + INTERVAL '${offsetDays} days'`
    : `CURRENT_DATE - INTERVAL '${offsetDays} days'`;

  // Build WHERE parts and positional params
  const params: unknown[] = [];
  const whereParts: string[] = [
    `${sourceTable}.${triggerField}::date = ${intervalExpr}`,
  ];

  const safeBoolOps = new Set(["=", "!=", ">", "<", ">=", "<="]);

  for (const cond of (filterConditions ?? [])) {
    const col = bare(cond.field);
    if (!isAllowedField(sourceTable, col)) {
      console.warn(`[cron-engine] Skipping unknown filter field "${cond.field}" in config id=${config.id}`);
      continue;
    }
    if (cond.operator === "IS NULL") {
      whereParts.push(`${sourceTable}.${col} IS NULL`);
    } else if (cond.operator === "IS NOT NULL") {
      whereParts.push(`${sourceTable}.${col} IS NOT NULL`);
    } else {
      const op = safeBoolOps.has(cond.operator) ? cond.operator : "=";
      params.push(cond.value);
      whereParts.push(`${sourceTable}.${col} ${op} $${params.length}`);
    }
  }

  // Determine SELECT columns: source table + joined table if present
  const joinedTable = recipientJoin
    ? (recipientJoin.match(/\bJOIN\s+(\w+)/i)?.[1] ?? null)
    : null;

  const selectCols = joinedTable
    ? `${sourceTable}.*, ${joinedTable}.*`
    : `${sourceTable}.*`;

  const queryStr = [
    `SELECT ${selectCols}`,
    `FROM ${sourceTable}`,
    recipientJoin ?? "",
    `WHERE ${whereParts.join(" AND ")}`,
    `LIMIT 500`,
  ].filter(Boolean).join(" ");

  // Execute with parameterized values
  let rows: Record<string, unknown>[] = [];
  try {
    const result = await pool.query(queryStr, params);
    rows = result.rows ?? [];
  } catch (err: any) {
    console.error(`[cron-engine] Query failed for config id=${config.id}:`, err?.message, "\nSQL:", queryStr);
    return { sent: 0, errors: 1 };
  }

  // Look up template trigger event
  const templates = await storage.getEmailTemplates();
  const template = templates.find(t => t.id === templateId);
  if (!template?.triggerEvent) {
    console.error(`[cron-engine] No template/triggerEvent for templateId=${templateId} (config id=${config.id})`);
    return { sent: 0, errors: 1 };
  }

  const recipientCol = bare(recipientField);
  let sent = 0;
  let errors = 0;

  for (const row of rows) {
    const recipientEmail = row[recipientCol] as string | undefined;
    if (!recipientEmail || typeof recipientEmail !== "string") continue;

    const vars: Record<string, string> = {
      site_name: SITE_NAME,
      site_url: SITE_URL,
      dashboard_url: `${SITE_URL}/dashboard`,
    };

    for (const [tokenName, mappingValue] of Object.entries(variableMappings ?? {})) {
      if (typeof mappingValue === "string" && mappingValue.startsWith("literal:")) {
        vars[tokenName] = mappingValue.slice("literal:".length);
      } else {
        const colVal = row[mappingValue] ?? row[bare(String(mappingValue))];
        vars[tokenName] = formatDateValue(colVal);
      }
    }

    try {
      await sendTemplatedEmailByEvent(template.triggerEvent, recipientEmail, vars);
      sent++;
    } catch (err: any) {
      console.error(`[cron-engine] Send failed (config id=${config.id}, to=${recipientEmail}):`, err?.message);
      errors++;
    }
  }

  return { sent, errors };
}

// ── Engine tick ───────────────────────────────────────────────────────────────

/** Returns true if `runTime` (HH:MM UTC) falls within the 15-minute window ending at `now`. */
function isTimeDue(runTime: string, now: Date): boolean {
  const [rh, rm] = runTime.split(":").map(Number);
  if (isNaN(rh) || isNaN(rm)) return false;
  const runMinutes = rh * 60 + rm;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const diff = nowMinutes - runMinutes;
  return diff >= 0 && diff < 15;
}

async function runDynamicCronEngine(): Promise<void> {
  const now = new Date();
  const todayUTCStr = now.toISOString().slice(0, 10);

  let configs: EmailCronConfig[] = [];
  try {
    configs = await storage.getEmailCronConfigs();
  } catch (err: any) {
    console.error("[cron-engine] Failed to load configs:", err?.message);
    return;
  }

  const due = configs.filter(c => {
    if (!c.isActive) return false;
    if (!isTimeDue(c.runTime, now)) return false;
    if (c.lastRunAt) {
      const lastDay = new Date(c.lastRunAt).toISOString().slice(0, 10);
      if (lastDay === todayUTCStr) return false;
    }
    return true;
  });

  if (due.length === 0) return;
  const nowHH = String(now.getUTCHours()).padStart(2, "0");
  const nowMM = String(now.getUTCMinutes()).padStart(2, "0");
  console.log(`[cron-engine] ${due.length} config(s) due at ${nowHH}:${nowMM} UTC`);

  for (const config of due) {
    console.log(`[cron-engine] Running "${config.name}" (id=${config.id})`);
    try {
      const { sent, errors } = await runConfig(config);
      await storage.touchEmailCronConfigLastRun(config.id);
      console.log(`[cron-engine] "${config.name}" done — sent=${sent} errors=${errors}`);
    } catch (err: any) {
      console.error(`[cron-engine] Error in config id=${config.id}:`, err?.message);
    }
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const TICK_MS = 15 * 60 * 1000;

export function initEmailCronJobs(): void {
  const now = new Date();
  const msUntilFirstTick = TICK_MS - (now.getTime() % TICK_MS);

  setTimeout(() => {
    runDynamicCronEngine().catch(e => console.error("[cron-engine] tick error:", e?.message));
    setInterval(() => {
      runDynamicCronEngine().catch(e => console.error("[cron-engine] tick error:", e?.message));
    }, TICK_MS);
  }, msUntilFirstTick);

  console.log(`[cron-engine] Initialized. Ticking every 15 min, first tick in ${Math.round(msUntilFirstTick / 1000)}s.`);
}

// ─── LEGACY CRON BLOCK (preserved for reference) ─────────────────────────────
// The three functions below were the original hard-coded scheduled jobs before
// Task #45 replaced them with the database-driven engine above.
//
// function runFeatureExpiringCron() {
//   // Queried users WHERE resume_access_expires_at = CURRENT_DATE + 7
//   // OR featured_employer_expires_at = CURRENT_DATE + 7
//   // and sent 'account_expiring' template emails.
// }
//
// function runJobExpiringCron() {
//   // Queried jobs WHERE expires_at = CURRENT_DATE + 7
//   // and sent 'job_expiring' template emails.
// }
//
// function runProfileIncompleteReminderCron() {
//   // Queried users WHERE profile_incomplete conditions
//   // and sent 'profile_incomplete_reminder' template emails.
// }
//
// All three are now fully replaced by the dynamic engine and the four seeded
// rows in email_cron_configs. See git history for the original implementations.
// ─────────────────────────────────────────────────────────────────────────────
