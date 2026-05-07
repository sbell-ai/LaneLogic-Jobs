import { db } from "../db";
import { categories, type Category, type InsertCategory } from "@shared/schema";
import { eq } from "drizzle-orm";

export const categoryStorage = {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  },
  async createCategory(category: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(category as any).returning();
    return cat;
  },
  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  },
};
