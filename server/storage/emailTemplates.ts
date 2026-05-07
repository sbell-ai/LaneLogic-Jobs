import { db } from "../db";
import { emailTemplates, type EmailTemplate, type InsertEmailTemplate } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export const emailTemplateStorage = {
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).orderBy(asc(emailTemplates.slug));
  },

  async getEmailTemplateBySlug(slug: string): Promise<EmailTemplate | undefined> {
    const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.slug, slug));
    return t;
  },

  async upsertEmailTemplate(slug: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const now = new Date();
    const existing = await emailTemplateStorage.getEmailTemplateBySlug(slug);
    if (existing) {
      const [updated] = await db
        .update(emailTemplates)
        .set({ ...data, updatedAt: now } as any)
        .where(eq(emailTemplates.slug, slug))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(emailTemplates)
      .values({ slug, name: (data as any).name ?? slug, subject: (data as any).subject ?? "", body: (data as any).body ?? "", variables: (data as any).variables ?? [], isActive: (data as any).isActive ?? true, ...data } as any)
      .returning();
    return created;
  },
};
