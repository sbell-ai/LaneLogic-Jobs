import { db } from "../db";
import * as schema from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

export type Environment = "prod" | "staging" | "development" | string;

export async function writeRegistrySnapshot(args: {
  environment: Environment;
  registryName: string;
  contentHash: string;
  payload: unknown;
  rowUrls: string[];
  validRowCount: number;
  invalidRowCount: number;
}) {
  const [row] = await db
    .insert(schema.registrySnapshots)
    .values({
      environment: args.environment,
      registryName: args.registryName,
      contentHash: args.contentHash,
      payload: args.payload,
      rowUrls: args.rowUrls,
      validRowCount: args.validRowCount,
      invalidRowCount: args.invalidRowCount,
      isLastKnownGood: false,
      isActive: false,
    })
    .returning();

  if (!row) throw new Error("Failed to insert registry snapshot");
  return row;
}

export async function getActiveRegistrySnapshot(environment: Environment, registryName: string) {
  const [row] = await db
    .select()
    .from(schema.registrySnapshots)
    .where(
      and(
        eq(schema.registrySnapshots.environment, environment),
        eq(schema.registrySnapshots.registryName, registryName),
        eq(schema.registrySnapshots.isActive, true),
      ),
    )
    .orderBy(desc(schema.registrySnapshots.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getLastKnownGoodRegistrySnapshot(environment: Environment, registryName: string) {
  const [row] = await db
    .select()
    .from(schema.registrySnapshots)
    .where(
      and(
        eq(schema.registrySnapshots.environment, environment),
        eq(schema.registrySnapshots.registryName, registryName),
        eq(schema.registrySnapshots.isLastKnownGood, true),
      ),
    )
    .orderBy(desc(schema.registrySnapshots.createdAt))
    .limit(1);

  return row ?? null;
}

export async function setLastKnownGoodSnapshot(args: {
  snapshotId: number;
  environment: Environment;
  registryName: string;
}) {
  await db
    .update(schema.registrySnapshots)
    .set({ isLastKnownGood: false })
    .where(
      and(
        eq(schema.registrySnapshots.environment, args.environment),
        eq(schema.registrySnapshots.registryName, args.registryName),
        eq(schema.registrySnapshots.isLastKnownGood, true),
      ),
    );

  await db
    .update(schema.registrySnapshots)
    .set({ isLastKnownGood: true })
    .where(eq(schema.registrySnapshots.id, args.snapshotId));
}

export async function setActiveSnapshot(args: {
  snapshotId: number;
  environment: Environment;
  registryName: string;
}) {
  await db
    .update(schema.registrySnapshots)
    .set({ isActive: false })
    .where(
      and(
        eq(schema.registrySnapshots.environment, args.environment),
        eq(schema.registrySnapshots.registryName, args.registryName),
        eq(schema.registrySnapshots.isActive, true),
      ),
    );

  await db
    .update(schema.registrySnapshots)
    .set({ isActive: true })
    .where(eq(schema.registrySnapshots.id, args.snapshotId));
}