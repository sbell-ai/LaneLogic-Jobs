import { db } from "../db";
import {
  users,
  type User,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export const adminProfileStorage = {
  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "admin"));
  },

  async updateLastLoginAt(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() } as any).where(eq(users.id, id));
  },

  async getNotificationPreferences(id: number): Promise<Record<string, boolean>> {
    const [user] = await db.select({ notificationPreferences: users.notificationPreferences }).from(users).where(eq(users.id, id));
    return (user?.notificationPreferences as Record<string, boolean>) ?? {};
  },

  async updateNotificationPreferences(id: number, prefs: Record<string, boolean>): Promise<void> {
    await db.update(users).set({ notificationPreferences: prefs } as any).where(eq(users.id, id));
  },

  async inviteAdminUser(email: string, firstName: string, lastName: string, tempPassword: string, permissions: string[] | null): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ email, password: tempPassword, role: "admin", membershipTier: "free", firstName, lastName, permissions: permissions as any } as any)
      .returning();
    return user;
  },

  async updateAdminUserRole(id: number, role: string): Promise<User> {
    const [user] = await db.update(users).set({ role } as any).where(eq(users.id, id)).returning();
    return user;
  },
};
