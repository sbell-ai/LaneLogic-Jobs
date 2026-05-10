// Sprint 6 — Email dedup. Inserts an email_log row inside a try/catch on the
// UNIQUE (user_id, template, reference_id) constraint. If the insert fires the
// unique violation, we return false — caller should not send.
//
// Returns true ⇒ proceed with send. Returns false ⇒ already sent, skip.

import { db } from "../db";
import { emailLog, type EmailTemplateName } from "@shared/schema";

export async function checkAndLogEmail(
  userId: number,
  template: EmailTemplateName,
  referenceId: string | null,
): Promise<boolean> {
  try {
    await db.insert(emailLog).values({
      userId,
      template,
      referenceId,
    });
    return true;
  } catch (err: any) {
    const pgCode = err?.code ?? err?.cause?.code;
    if (pgCode === "23505") {
      // unique_violation — already sent
      return false;
    }
    console.error("[emailDedup] insert failed:", err);
    return false;
  }
}
