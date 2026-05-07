import { db } from "../db";
import { socialPosts, type SocialPost, type InsertSocialPost } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const socialPostStorage = {
  async createSocialPost(data: InsertSocialPost): Promise<SocialPost> {
    const [post] = await db.insert(socialPosts).values(data as any).returning();
    return post;
  },
  async getSocialPost(id: number): Promise<SocialPost | undefined> {
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, id));
    return post;
  },
  async listSocialPosts(filters?: { status?: string; entityType?: string }): Promise<SocialPost[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(socialPosts.status, filters.status));
    if (filters?.entityType) conditions.push(eq(socialPosts.entityType, filters.entityType));
    if (conditions.length > 0) {
      return await db.select().from(socialPosts).where(and(...conditions)).orderBy(desc(socialPosts.createdAt));
    }
    return await db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt));
  },
  async updateSocialPost(id: number, updates: Partial<InsertSocialPost>): Promise<SocialPost> {
    const [post] = await db.update(socialPosts).set({ ...updates, updatedAt: new Date() } as any).where(eq(socialPosts.id, id)).returning();
    return post;
  },
  async deleteSocialPost(id: number): Promise<void> {
    await db.delete(socialPosts).where(eq(socialPosts.id, id));
  },
};
