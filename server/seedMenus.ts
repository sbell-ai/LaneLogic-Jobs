import { storage } from "./storage";

type ItemSeed = {
  label: string;
  type?: string;
  url?: string;
  openInNewTab?: boolean;
  visibility?: string;
  sortOrder: number;
  children?: ItemSeed[];
};

async function seedMenu(
  slug: string,
  name: string,
  location: string,
  description: string,
  items: ItemSeed[]
) {
  let menu = await storage.getMenuBySlug(slug);
  if (!menu) {
    menu = await storage.createMenu({
      slug,
      name,
      location,
      description,
      isActive: true,
      isDefault: true,
    });
  }

  const existing = await storage.getMenuItems(menu.id);
  if (existing.length > 0) return;

  for (const item of items) {
    const parent = await storage.createMenuItem({
      menuId: menu.id,
      parentId: null,
      label: item.label,
      type: item.type ?? "internal",
      url: item.url ?? null,
      pageId: null,
      openInNewTab: item.openInNewTab ?? false,
      visibility: item.visibility ?? "always",
      sortOrder: item.sortOrder,
      isActive: true,
    });

    if (item.children) {
      for (let ci = 0; ci < item.children.length; ci++) {
        const child = item.children[ci];
        await storage.createMenuItem({
          menuId: menu.id,
          parentId: parent.id,
          label: child.label,
          type: child.type ?? "internal",
          url: child.url ?? null,
          pageId: null,
          openInNewTab: child.openInNewTab ?? false,
          visibility: child.visibility ?? "always",
          sortOrder: ci,
          isActive: true,
        });
      }
    }
  }
}

export async function seedMenus() {
  try {
    // main-nav
    await seedMenu("main-nav", "Main Navigation", "navbar", "Primary navbar links", [
      { label: "Jobs", url: "/jobs", sortOrder: 0 },
      { label: "Employers", url: "/employers", sortOrder: 1 },
      { label: "Resources", url: "/resources", sortOrder: 2 },
      { label: "Blog", url: "/blog", sortOrder: 3 },
      { label: "Pricing", url: "/pricing", sortOrder: 4 },
      { label: "User Guides", url: "/guides", sortOrder: 5 },
      { label: "Dashboard", url: "/dashboard", visibility: "logged_in_only", sortOrder: 6 },
      { label: "Sign In", url: "#auth-login", type: "anchor", visibility: "logged_out_only", sortOrder: 7 },
      { label: "Register", url: "#auth-signup", type: "anchor", visibility: "logged_out_only", sortOrder: 8 },
    ]);

    // footer — top-level items are group headings with children
    await seedMenu("footer", "Footer", "footer", "Footer navigation columns", [
      {
        label: "Candidates",
        type: "anchor",
        url: "#",
        sortOrder: 0,
        children: [
          { label: "Browse Jobs", url: "/jobs", sortOrder: 0 },
          { label: "Create Profile", url: "/register", sortOrder: 1 },
          { label: "Resource Center", url: "/resources", sortOrder: 2 },
          { label: "Career Advice", url: "/blog", sortOrder: 3 },
          { label: "Job Seeker Guide", url: "/guides/job-seeker", sortOrder: 4 },
        ],
      },
      {
        label: "Employers",
        type: "anchor",
        url: "#",
        sortOrder: 1,
        children: [
          { label: "Post a Job", url: "/register", sortOrder: 0 },
          { label: "Pricing", url: "/pricing", sortOrder: 1 },
          { label: "Employer Resources", url: "/resources", sortOrder: 2 },
          { label: "Employer Guide", url: "/guides/employer", sortOrder: 3 },
        ],
      },
      {
        label: "Company",
        type: "anchor",
        url: "#",
        sortOrder: 2,
        children: [
          { label: "About Us", url: "/about", sortOrder: 0 },
          { label: "Contact", url: "https://mailgun-form-sender.replit.app", openInNewTab: true, sortOrder: 1 },
          { label: "Privacy Policy", url: "/privacy", sortOrder: 2 },
          { label: "Terms of Service", url: "/terms", sortOrder: 3 },
        ],
      },
    ]);

    // mobile — mirrors main-nav items
    await seedMenu("mobile", "Mobile Menu", "mobile", "Mobile hamburger menu (mirrors main-nav)", [
      { label: "Jobs", url: "/jobs", sortOrder: 0 },
      { label: "Employers", url: "/employers", sortOrder: 1 },
      { label: "Resources", url: "/resources", sortOrder: 2 },
      { label: "Blog", url: "/blog", sortOrder: 3 },
      { label: "Pricing", url: "/pricing", sortOrder: 4 },
      { label: "User Guides", url: "/guides", sortOrder: 5 },
      { label: "Dashboard", url: "/dashboard", visibility: "logged_in_only", sortOrder: 6 },
      { label: "Sign In", url: "#auth-login", type: "anchor", visibility: "logged_out_only", sortOrder: 7 },
      { label: "Register", url: "#auth-signup", type: "anchor", visibility: "logged_out_only", sortOrder: 8 },
    ]);

    // sidebar-custom — empty placeholder for future custom admin sidebar links
    await seedMenu("sidebar-custom", "Sidebar (Custom)", "sidebar-custom", "Custom links for the admin sidebar", []);

    console.log("[seedMenus] Default menus seeded.");
  } catch (err) {
    console.error("[seedMenus] Failed:", err);
  }
}
