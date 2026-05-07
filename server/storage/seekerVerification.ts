import { db } from "../db";
import {
  seekerCredentialRequirements, seekerRequirementRules,
  seekerVerificationRequests, seekerCredentialEvidenceItems, users,
  type SeekerCredentialRequirement, type InsertSeekerCredentialRequirement,
  type SeekerRequirementRule, type InsertSeekerRequirementRule,
  type SeekerVerificationRequest, type InsertSeekerVerificationRequest,
  type SeekerCredentialEvidenceItem, type InsertSeekerCredentialEvidenceItem,
  type User,
} from "@shared/schema";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";

export const seekerVerificationStorage = {
  async getSeekerCredentialRequirements(): Promise<SeekerCredentialRequirement[]> {
    return await db.select().from(seekerCredentialRequirements).orderBy(asc(seekerCredentialRequirements.key));
  },

  async upsertSeekerCredentialRequirement(req: InsertSeekerCredentialRequirement): Promise<SeekerCredentialRequirement> {
    const [result] = await db.insert(seekerCredentialRequirements)
      .values(req as any)
      .onConflictDoUpdate({ target: seekerCredentialRequirements.key, set: { label: (req as any).label, description: (req as any).description ?? null, category: (req as any).category ?? "license" } as any })
      .returning();
    return result;
  },

  async getSeekerRequirementRules(): Promise<SeekerRequirementRule[]> {
    return await db.select().from(seekerRequirementRules);
  },

  async upsertSeekerRequirementRule(rule: InsertSeekerRequirementRule): Promise<SeekerRequirementRule> {
    const existing = await db.select().from(seekerRequirementRules)
      .where(and(
        eq(seekerRequirementRules.requirementKey, (rule as any).requirementKey),
        eq(seekerRequirementRules.conditionType, (rule as any).conditionType),
        eq(seekerRequirementRules.conditionValue, (rule as any).conditionValue)
      ))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [result] = await db.insert(seekerRequirementRules).values(rule as any).returning();
    return result;
  },

  async getActiveSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined> {
    const [req] = await db.select().from(seekerVerificationRequests)
      .where(and(
        eq(seekerVerificationRequests.seekerId, seekerId),
        inArray(seekerVerificationRequests.status, ["draft", "submitted", "needs_more"])
      ))
      .limit(1);
    return req;
  },

  async getLatestSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest | undefined> {
    const [req] = await db.select().from(seekerVerificationRequests)
      .where(eq(seekerVerificationRequests.seekerId, seekerId))
      .orderBy(desc(seekerVerificationRequests.createdAt))
      .limit(1);
    return req;
  },

  async getOrCreateSeekerVerificationRequest(seekerId: number): Promise<SeekerVerificationRequest> {
    const existing = await seekerVerificationStorage.getActiveSeekerVerificationRequest(seekerId);
    if (existing) return existing;
    try {
      const [req] = await db.insert(seekerVerificationRequests)
        .values({ seekerId, status: "draft" } as any)
        .returning();
      return req;
    } catch (err: any) {
      if (err?.code === "23505") {
        const fallback = await seekerVerificationStorage.getActiveSeekerVerificationRequest(seekerId);
        if (fallback) return fallback;
      }
      throw err;
    }
  },

  async appendRequirementsSnapshot(requestId: number, keys: string[]): Promise<SeekerVerificationRequest> {
    const [req] = await db.select().from(seekerVerificationRequests).where(eq(seekerVerificationRequests.id, requestId)).limit(1);
    if (!req) throw new Error("Request not found");
    const existing = req.requirementsSnapshot || [];
    const merged = Array.from(new Set([...existing, ...keys]));
    const hasNewKeys = merged.length > existing.length;
    const updates: Record<string, any> = { requirementsSnapshot: merged, updatedAt: new Date() };
    if (hasNewKeys && req.status === "submitted") {
      updates.status = "needs_more";
      updates.adminNotes = (req.adminNotes ? req.adminNotes + "\n" : "") +
        "[System] New credential requirements added from job application. Status reverted to needs_more.";
    }
    const [updated] = await db.update(seekerVerificationRequests)
      .set(updates)
      .where(eq(seekerVerificationRequests.id, requestId))
      .returning();
    return updated;
  },

  async getSeekerVerificationRequestsByStatus(statuses: string[]): Promise<(SeekerVerificationRequest & { seekerName: string | null; seekerEmail: string; seekerTrack: string | null; cdlIsNonDomiciled: boolean; cdlMarkedNonDomiciledIssuingState: boolean })[]> {
    const rows = await db
      .select({
        id: seekerVerificationRequests.id,
        seekerId: seekerVerificationRequests.seekerId,
        status: seekerVerificationRequests.status,
        requirementsSnapshot: seekerVerificationRequests.requirementsSnapshot,
        adminNotes: seekerVerificationRequests.adminNotes,
        decidedBy: seekerVerificationRequests.decidedBy,
        decidedAt: seekerVerificationRequests.decidedAt,
        submittedAt: seekerVerificationRequests.submittedAt,
        createdAt: seekerVerificationRequests.createdAt,
        updatedAt: seekerVerificationRequests.updatedAt,
        seekerName: sql<string | null>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`.as("seeker_name"),
        seekerEmail: users.email,
        seekerTrack: users.seekerTrack,
        cdlIsNonDomiciled: users.cdlIsNonDomiciled,
        cdlMarkedNonDomiciledIssuingState: users.cdlMarkedNonDomiciledIssuingState,
      })
      .from(seekerVerificationRequests)
      .innerJoin(users, eq(seekerVerificationRequests.seekerId, users.id))
      .where(inArray(seekerVerificationRequests.status, statuses))
      .orderBy(desc(seekerVerificationRequests.submittedAt));
    return rows;
  },

  async updateSeekerVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<SeekerVerificationRequest> {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (decidedBy !== undefined) updates.decidedBy = decidedBy;
    if (status === "submitted") updates.submittedAt = new Date();
    if (["verified", "rejected"].includes(status)) updates.decidedAt = new Date();
    const [req] = await db.update(seekerVerificationRequests)
      .set(updates)
      .where(eq(seekerVerificationRequests.id, requestId))
      .returning();
    return req;
  },

  async createSeekerEvidenceItem(item: InsertSeekerCredentialEvidenceItem): Promise<SeekerCredentialEvidenceItem> {
    const [evidence] = await db.insert(seekerCredentialEvidenceItems).values(item as any).returning();
    return evidence;
  },

  async getSeekerEvidenceItemsByRequest(requestId: number): Promise<SeekerCredentialEvidenceItem[]> {
    return await db.select().from(seekerCredentialEvidenceItems)
      .where(eq(seekerCredentialEvidenceItems.requestId, requestId))
      .orderBy(desc(seekerCredentialEvidenceItems.createdAt));
  },

  async updateSeekerVerificationStatus(seekerId: number, status: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ seekerVerificationStatus: status } as any)
      .where(eq(users.id, seekerId))
      .returning();
    return user;
  },
};
