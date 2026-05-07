import { db } from "../db";
import { resources, type Resource, type InsertResource } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const resourceStorage = {
  async getResources(context: "admin" | "public" = "public"): Promise<Resource[]> {
    if (context === "admin") {
      return await db.select().from(resources).orderBy(desc(resources.updatedAt));
    }
    return await db.select().from(resources)
      .where(eq(resources.isPublished, true))
      .orderBy(desc(resources.publishedAt), desc(resources.id));
  },
  async getResource(id: number): Promise<Resource | undefined> {
    const [res] = await db.select().from(resources).where(eq(resources.id, id));
    return res;
  },
  async getResourceBySlug(slug: string): Promise<Resource | undefined> {
    const [res] = await db.select().from(resources).where(eq(resources.slug, slug));
    return res;
  },
  async generateUniqueResourceSlug(title: string): Promise<string> {
    let base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!base || /^\d+$/.test(base)) {
      base = base ? `resource-${base}` : "resource";
    }
    let slug = base;
    let suffix = 2;
    while (true) {
      const existing = await resourceStorage.getResourceBySlug(slug);
      if (!existing) return slug;
      slug = `${base}-${suffix}`;
      suffix++;
    }
  },
  async createResource(resource: InsertResource): Promise<Resource> {
    const slug = await resourceStorage.generateUniqueResourceSlug((resource as any).title);
    const [res] = await db.insert(resources).values({ ...resource, slug } as any).returning();
    return res;
  },
  async updateResource(id: number, updates: Partial<InsertResource>): Promise<Resource> {
    const [res] = await db.update(resources).set({ ...updates, updatedAt: new Date() } as any).where(eq(resources.id, id)).returning();
    return res;
  },
  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  },
};
