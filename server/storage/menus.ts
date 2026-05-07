import { db } from "../db";
import {
  menus, menuItems,
  type Menu, type InsertMenu,
  type MenuItem, type InsertMenuItem,
} from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export const menuStorage = {
  async getMenus(): Promise<Menu[]> {
    return await db.select().from(menus).orderBy(asc(menus.name));
  },

  async getMenuById(id: number): Promise<Menu | undefined> {
    const [menu] = await db.select().from(menus).where(eq(menus.id, id));
    return menu;
  },

  async getMenuBySlug(slug: string): Promise<Menu | undefined> {
    const [menu] = await db.select().from(menus).where(eq(menus.slug, slug));
    return menu;
  },

  async createMenu(data: InsertMenu): Promise<Menu> {
    const [menu] = await db.insert(menus).values(data as any).returning();
    return menu;
  },

  async updateMenu(id: number, data: Partial<InsertMenu>): Promise<Menu> {
    const [menu] = await db
      .update(menus)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(menus.id, id))
      .returning();
    return menu;
  },

  async deleteMenu(id: number): Promise<void> {
    await db.delete(menus).where(eq(menus.id, id));
  },

  async getMenuItems(menuId: number): Promise<MenuItem[]> {
    return await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.menuId, menuId))
      .orderBy(asc(menuItems.sortOrder), asc(menuItems.id));
  },

  async createMenuItem(data: InsertMenuItem): Promise<MenuItem> {
    const [item] = await db.insert(menuItems).values(data as any).returning();
    return item;
  },

  async updateMenuItem(id: number, data: Partial<InsertMenuItem>): Promise<MenuItem> {
    const [item] = await db.update(menuItems).set(data).where(eq(menuItems.id, id)).returning();
    return item;
  },

  async deleteMenuItem(id: number): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.id, id));
  },

  async reorderMenuItems(items: { id: number; sortOrder: number; parentId: number | null }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, sortOrder, parentId }) =>
        db.update(menuItems).set({ sortOrder, parentId } as any).where(eq(menuItems.id, id))
      )
    );
  },

  async menuSlugExists(slug: string, excludeId?: number): Promise<boolean> {
    const rows = await db.select({ id: menus.id }).from(menus).where(eq(menus.slug, slug));
    if (rows.length === 0) return false;
    if (excludeId !== undefined) return rows[0].id !== excludeId;
    return true;
  },
};
