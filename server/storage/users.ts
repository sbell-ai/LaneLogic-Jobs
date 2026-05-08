import { z } from "zod";
import { db } from "../db";
import { users, seekerCertProfiles, type User, type InsertUser, type SeekerCertProfile } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { seekerCertSchema, ENDORSEMENT_FLAG_MAP } from "../../shared/certEnums";

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

    const slug = normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);

    const baseEmail = `employer+${slug}@auto.lanelogicjobs.com`;
    let email = baseEmail;
    let suffix = 1;
    while (await userStorage.getUserByEmail(email)) {
      email = `employer+${slug}-${suffix}@auto.lanelogicjobs.com`;
      suffix++;
    }

    const [created] = await db
      .insert(users)
      .values({
        email,
        password: "",
        role: "employer",
        companyName: normalized,
        membershipTier: "free",
      } as any)
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

  // --- Cert profile ---

  async updateSeekerCertProfile(
    userId: number,
    data: z.infer<typeof seekerCertSchema>
  ): Promise<SeekerCertProfile> {
    const endorsements = data.cdlEndorsements ?? [];
    const derivedFlags = {
      hasHazmat: endorsements.some((e) => e === "H" || e === "X"),
      hasTanker: endorsements.includes("N"),
      hasDoubleTriple: endorsements.includes("T"),
      hasPassenger: endorsements.includes("P"),
      hasSchoolBus: endorsements.includes("S"),
    };

    const [row] = await db
      .insert(seekerCertProfiles)
      .values({ userId, ...data, ...derivedFlags })
      .onConflictDoUpdate({
        target: seekerCertProfiles.userId,
        set: { ...data, ...derivedFlags },
      })
      .returning();
    return row;
  },

  async getSeekerCertProfile(userId: number): Promise<SeekerCertProfile | null> {
    const [row] = await db
      .select()
      .from(seekerCertProfiles)
      .where(eq(seekerCertProfiles.userId, userId));
    return row ?? null;
  },
};