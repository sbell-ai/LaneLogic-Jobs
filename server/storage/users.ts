import { db } from "../db";
import { users, type User, type InsertUser } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export const userStorage = {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },
  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  },
  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  },
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  },
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  },
  async findOrCreateEmployerByCompanyName(companyName: string): Promise<User> {
    const normalized = companyName.trim();
    const [existing] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "employer"),
          sql`lower(${users.companyName}) = lower(${normalized})`
        )
      )
      .limit(1);
    if (existing) return existing;
    const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const baseEmail = `employer+${slug}@auto.lanelogicjobs.com`;
    let email = baseEmail;
    let suffix = 1;
    while (await userStorage.getUserByEmail(email)) {
      email = `employer+${slug}-${suffix}@auto.lanelogicjobs.com`;
      suffix++;
    }
    const [created] = await db
      .insert(users)
      .values({ email, password: "", role: "employer", companyName: normalized, membershipTier: "free" } as any)
      .returning();
    return created;
  },
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  },
  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  },
};
