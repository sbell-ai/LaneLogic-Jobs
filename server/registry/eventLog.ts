import { db } from "../db";
import * as schema from "@shared/schema";

export type Severity = "SEV-1" | "SEV-2" | "SEV-3";

export async function logRegistryEvent(args: {
  environment: string;
  registryName: string;
  eventType: string;
  severity: Severity;
  validationRuleId?: string;
  rowUrl?: string;
  reason?: string;
  activeSnapshotId?: number;
  lastKnownGoodSnapshotId?: number;
  details?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(schema.registryEvents)
    .values({
      environment: args.environment,
      registryName: args.registryName,
      eventType: args.eventType,
      severity: args.severity,
      ...(args.validationRuleId !== undefined && { validationRuleId: args.validationRuleId }),
      ...(args.rowUrl !== undefined && { rowUrl: args.rowUrl }),
      ...(args.reason !== undefined && { reason: args.reason }),
      ...(args.activeSnapshotId !== undefined && { activeSnapshotId: args.activeSnapshotId }),
      ...(args.lastKnownGoodSnapshotId !== undefined && { lastKnownGoodSnapshotId: args.lastKnownGoodSnapshotId }),
      ...(args.details !== undefined && { details: args.details }),
    })
    .returning();

  if (!row) throw new Error("Failed to insert registry event");
  return row;
}