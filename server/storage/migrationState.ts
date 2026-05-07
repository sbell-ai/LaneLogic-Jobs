import { db } from "../db";
import {
  migrationState,
  type MigrationState, type InsertMigrationState,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export const migrationStateStorage = {
  async getMigrationState(key: string): Promise<MigrationState | undefined> {
    const [m] = await db.select().from(migrationState).where(eq(migrationState.key, key));
    return m;
  },
  async setMigrationState(state: InsertMigrationState): Promise<MigrationState> {
    const existing = await migrationStateStorage.getMigrationState((state as any).key);
    if (existing) {
      const [m] = await db.update(migrationState).set(state as any).where(eq(migrationState.key, (state as any).key)).returning();
      return m;
    }
    const [m] = await db.insert(migrationState).values(state as any).returning();
    return m;
  },
};
