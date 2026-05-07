import { db } from "../db";
import { siteSettings, type SiteSettingsData, DEFAULT_SETTINGS } from "@shared/schema";
import { eq } from "drizzle-orm";

export const siteSettingsStorage = {
  async getSiteSettings(): Promise<SiteSettingsData> {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length === 0) return { ...DEFAULT_SETTINGS };
    return rows[0].settings;
  },
  async updateSiteSettings(settings: SiteSettingsData): Promise<SiteSettingsData> {
    const rows = await db.select().from(siteSettings).limit(1);
    if (rows.length === 0) {
      const [row] = await db.insert(siteSettings).values({ settings }).returning();
      return row.settings;
    } else {
      const [row] = await db.update(siteSettings)
        .set({ settings, updatedAt: new Date() } as any)
        .where(eq(siteSettings.id, rows[0].id))
        .returning();
      return row.settings;
    }
  },
};
