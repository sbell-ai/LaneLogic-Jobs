import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { insertMenuSchema, insertMenuItemSchema } from "@shared/schema";
import { db } from "../db";
import { pages } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ── Public: GET /api/menus/:slug ──────────────────────────────────────────
// Returns a menu with its items, nested, filtered by visibility based on auth.
router.get("/menus/:slug", async (req: Request, res: Response) => {
  try {
    const menu = await storage.getMenuBySlug(req.params.slug as string);
    if (!menu || !menu.isActive) {
      return res.status(404).json({ error: "Menu not found" });
    }

    const allItems = await storage.getMenuItems(menu.id);
    const user = (req as any).user as { role?: string } | undefined;
    const isLoggedIn = !!user;

    // Filter by visibility
    const visible = allItems.filter((item) => {
      if (!item.isActive) return false;
      if (item.visibility === "logged_in_only" && !isLoggedIn) return false;
      if (item.visibility === "logged_out_only" && isLoggedIn) return false;
      return true;
    });

    // Resolve CMS page URLs
    const pageIds = visible.filter((i) => i.type === "cms_page" && i.pageId).map((i) => i.pageId!);
    let pageMap: Record<number, string> = {};
    if (pageIds.length > 0) {
      const pgRows = await db.select({ id: pages.id, slug: pages.slug }).from(pages).where(
        pageIds.length === 1 ? eq(pages.id, pageIds[0]) : eq(pages.id, pageIds[0])
      );
      pgRows.forEach((p) => { pageMap[p.id] = `/pages/${p.slug}`; });
    }

    // Nest items
    const itemMap = new Map<number, any>();
    visible.forEach((item) => {
      const url = item.type === "cms_page" && item.pageId ? pageMap[item.pageId] ?? item.url : item.url;
      itemMap.set(item.id, { ...item, url, children: [] });
    });

    const nested: any[] = [];
    visible.forEach((item) => {
      const node = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(node);
      } else {
        nested.push(node);
      }
    });

    res.json({ ...menu, items: nested });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: all require admin session ─────────────────────────────────────

// GET /api/admin/menus
router.get("/admin/menus", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const allMenus = await storage.getMenus();
    res.json(allMenus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/menus
router.post("/admin/menus", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const parsed = insertMenuSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const slugTaken = await storage.menuSlugExists((parsed.data as any).slug);
    if (slugTaken) return res.status(409).json({ error: "Slug already in use" });
    const menu = await storage.createMenu(parsed.data);
    res.status(201).json(menu);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/menus/:id
router.get("/admin/menus/:id", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const id = Number(req.params.id);
    const menu = await storage.getMenuById(id);
    if (!menu) return res.status(404).json({ error: "Not found" });
    const items = await storage.getMenuItems(id);
    res.json({ ...menu, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/menus/:id
router.patch("/admin/menus/:id", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const id = Number(req.params.id);
    const existing = await storage.getMenuById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.body.slug && req.body.slug !== existing.slug) {
      const slugTaken = await storage.menuSlugExists(req.body.slug, id);
      if (slugTaken) return res.status(409).json({ error: "Slug already in use" });
    }
    const menu = await storage.updateMenu(id, req.body);
    res.json(menu);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/menus/:id
router.delete("/admin/menus/:id", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const id = Number(req.params.id);
    const existing = await storage.getMenuById(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.isDefault) return res.status(400).json({ error: "Cannot delete a default menu" });
    await storage.deleteMenu(id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/menus/:id/items
router.get("/admin/menus/:id/items", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const items = await storage.getMenuItems(Number(req.params.id));
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/menus/:id/items
router.post("/admin/menus/:id/items", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const menuId = Number(req.params.id);
    const parsed = insertMenuItemSchema.safeParse({ ...req.body, menuId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const item = await storage.createMenuItem(parsed.data);
    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/menus/:id/items/:itemId
router.patch("/admin/menus/:id/items/:itemId", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const item = await storage.updateMenuItem(Number(req.params.itemId), req.body);
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/menus/:id/items/:itemId
router.delete("/admin/menus/:id/items/:itemId", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    await storage.deleteMenuItem(Number(req.params.itemId));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/menus/:id/items/reorder
router.put("/admin/menus/:id/items/reorder", async (req: Request, res: Response) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const { items } = req.body as { items: { id: number; sortOrder: number; parentId: number | null }[] };
    if (!Array.isArray(items)) return res.status(400).json({ error: "items must be an array" });
    await storage.reorderMenuItems(items);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
