import { db } from "../db";
import * as schema from "@shared/schema";
import { and, desc, eq, gte } from "drizzle-orm";

export async function shouldSendAlert(args: {
  environment: string;
  registryName: string;
  eventType: string;
  withinMinutes: number;
}) {
  const since = new Date(Date.now() - args.withinMinutes * 60 * 1000);

  const [row] = await db
    .select()
    .from(schema.registryEvents)
    .where(
      and(
        eq(schema.registryEvents.environment, args.environment),
        eq(schema.registryEvents.registryName, args.registryName),
        eq(schema.registryEvents.eventType, args.eventType),
        gte(schema.registryEvents.createdAt, since),
      ),
    )
    .orderBy(desc(schema.registryEvents.createdAt))
    .limit(1);

  return !row;
}