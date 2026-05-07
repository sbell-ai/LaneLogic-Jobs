import { db } from "../db";
import {
  employerVerificationRequests, employerEvidenceItems, users,
  type EmployerVerificationRequest, type InsertEmployerVerificationRequest,
  type EmployerEvidenceItem, type InsertEmployerEvidenceItem,
  type User,
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

export const employerVerificationStorage = {
  async getActiveVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined> {
    const [req] = await db.select().from(employerVerificationRequests)
      .where(and(
        eq(employerVerificationRequests.employerId, employerId),
        inArray(employerVerificationRequests.status, ["draft", "submitted", "needs_more"])
      ))
      .limit(1);
    return req;
  },

  async getLatestVerificationRequest(employerId: number): Promise<EmployerVerificationRequest | undefined> {
    const [req] = await db.select().from(employerVerificationRequests)
      .where(eq(employerVerificationRequests.employerId, employerId))
      .orderBy(desc(employerVerificationRequests.createdAt))
      .limit(1);
    return req;
  },

  async getOrCreateVerificationRequest(employerId: number): Promise<EmployerVerificationRequest> {
    const existing = await employerVerificationStorage.getActiveVerificationRequest(employerId);
    if (existing) return existing;
    try {
      const [req] = await db.insert(employerVerificationRequests)
        .values({ employerId, status: "draft" } as any)
        .returning();
      return req;
    } catch (err: any) {
      if (err?.code === "23505") {
        const fallback = await employerVerificationStorage.getActiveVerificationRequest(employerId);
        if (fallback) return fallback;
      }
      throw err;
    }
  },

  async getVerificationRequestsByStatus(statuses: string[]): Promise<(EmployerVerificationRequest & { employerName: string | null; employerEmail: string })[]> {
    const rows = await db
      .select({
        id: employerVerificationRequests.id,
        employerId: employerVerificationRequests.employerId,
        status: employerVerificationRequests.status,
        adminNotes: employerVerificationRequests.adminNotes,
        decidedBy: employerVerificationRequests.decidedBy,
        decidedAt: employerVerificationRequests.decidedAt,
        submittedAt: employerVerificationRequests.submittedAt,
        createdAt: employerVerificationRequests.createdAt,
        updatedAt: employerVerificationRequests.updatedAt,
        employerName: users.companyName,
        employerEmail: users.email,
      })
      .from(employerVerificationRequests)
      .innerJoin(users, eq(employerVerificationRequests.employerId, users.id))
      .where(inArray(employerVerificationRequests.status, statuses))
      .orderBy(desc(employerVerificationRequests.submittedAt));
    return rows;
  },

  async updateVerificationRequestStatus(requestId: number, status: string, adminNotes?: string, decidedBy?: number): Promise<EmployerVerificationRequest> {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (decidedBy !== undefined) updates.decidedBy = decidedBy;
    if (status === "submitted") updates.submittedAt = new Date();
    if (["verified", "rejected"].includes(status)) updates.decidedAt = new Date();
    const [req] = await db.update(employerVerificationRequests)
      .set(updates)
      .where(eq(employerVerificationRequests.id, requestId))
      .returning();
    return req;
  },

  async createEvidenceItem(item: InsertEmployerEvidenceItem): Promise<EmployerEvidenceItem> {
    const [evidence] = await db.insert(employerEvidenceItems).values(item as any).returning();
    return evidence;
  },

  async getEvidenceItemsByRequest(requestId: number): Promise<EmployerEvidenceItem[]> {
    return await db.select().from(employerEvidenceItems)
      .where(eq(employerEvidenceItems.requestId, requestId))
      .orderBy(desc(employerEvidenceItems.createdAt));
  },

  async updateEmployerVerificationStatus(employerId: number, status: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ verificationStatus: status } as any)
      .where(eq(users.id, employerId))
      .returning();
    return user;
  },
};
