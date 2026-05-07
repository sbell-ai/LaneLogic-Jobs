import { db } from "../db";
import { pages, type Page, type InsertPage } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const pageStorage = {
  async getPages(): Promise<Page[]> {
    return await db.select().from(pages).orderBy(desc(pages.createdAt));
  },
  async getPage(id: number): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.id, id));
    return page;
  },
  async getPageBySlug(slug: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page;
  },
  async createPage(page: InsertPage): Promise<Page> {
    const [p] = await db.insert(pages).values(page as any).returning();
    return p;
  },
  async updatePage(id: number, updates: Partial<InsertPage>): Promise<Page> {
    const [p] = await db.update(pages).set({ ...updates, updatedAt: new Date() } as any).where(eq(pages.id, id)).returning();
    return p;
  },
  async deletePage(id: number): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  },
};
