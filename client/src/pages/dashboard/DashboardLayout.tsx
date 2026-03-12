import { useState } from "react";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Briefcase, LayoutDashboard, FileText, LogOut, Users, BookOpen, Upload, CreditCard, UserPlus, PlusCircle, Palette, FileEdit, Tag, Ticket, UserCircle, FilePlus2, Share2, ChevronDown, ChevronRight, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLink {
  title: string;
  path: string;
  icon: any;
  children?: { title: string; path: string; icon: any }[];
}

function AppSidebar({ role }: { role: string }) {
  const [location] = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (location.startsWith("/dashboard/admin/users")) {
      initial.add("Users");
    }
    return initial;
  });

  const seekerLinks = [
    { title: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { title: "Applied Jobs", path: "/dashboard/applications", icon: Briefcase },
    { title: "My Resume", path: "/dashboard/resume", icon: FileText },
    { title: "My Profile", path: "/dashboard/profile", icon: UserCircle },
    { title: "Membership", path: "/dashboard/membership", icon: CreditCard },
  ];

  const employerLinks = [
    { title: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { title: "My Job Postings", path: "/dashboard/jobs", icon: Briefcase },
    { title: "Applicants", path: "/dashboard/applicants", icon: Users },
    { title: "Bulk Upload (CSV)", path: "/dashboard/upload", icon: Upload },
    { title: "Company Profile", path: "/dashboard/profile", icon: UserCircle },
    { title: "Membership", path: "/dashboard/membership", icon: CreditCard },
  ];

  const adminLinks: AdminLink[] = [
    {
      title: "Users", path: "/dashboard/admin/users", icon: Users,
      children: [
        { title: "Job Seeker Users", path: "/dashboard/admin/users/job-seekers", icon: UserCircle },
        { title: "Employer Users", path: "/dashboard/admin/users/employers", icon: Briefcase },
      ],
    },
    { title: "All Jobs", path: "/dashboard/admin/jobs", icon: Briefcase },
    { title: "Pages & Resources", path: "/dashboard/admin/pages-resources", icon: FileEdit },
    { title: "Blog Posts", path: "/dashboard/admin/blog", icon: FileText },
    { title: "Database", path: "/dashboard/admin/database", icon: Database },
    { title: "Coupons", path: "/dashboard/admin/coupons", icon: Ticket },
    { title: "Design Settings", path: "/dashboard/admin/design", icon: Palette },
    { title: "Social Publishing", path: "/dashboard/admin/social", icon: Share2 },
  ];

  const toggleExpanded = (title: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  const isChildActive = (item: AdminLink) => {
    if (item.children) {
      return item.children.some(c => location === c.path) || location === item.path;
    }
    return location === item.path;
  };

  const pagesResourcesPaths = ["/dashboard/admin/pages-resources", "/dashboard/admin/site-pages", "/dashboard/admin/custom-pages", "/dashboard/admin/resources"];
  const isActiveForItem = (item: AdminLink) => {
    if (item.path === "/dashboard/admin/pages-resources") {
      return pagesResourcesPaths.includes(location);
    }
    if (item.children) {
      return isChildActive(item);
    }
    return location === item.path;
  };

  if (role === "admin") {
    return (
      <Sidebar className="border-r border-border bg-card">
        <SidebarContent>
          <div className="p-4 py-6 border-b border-border">
            <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
              Transpo<span className="text-primary">Jobs</span>
            </Link>
          </div>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-4 mb-2 px-2">
              Admin Panel
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-1">
                {adminLinks.map((item) => {
                  const active = isActiveForItem(item);
                  const hasChildren = !!item.children;
                  const isExpanded = expandedMenus.has(item.title);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        {hasChildren ? (
                          <div className="flex flex-col w-full">
                            <div className="flex items-center w-full">
                              <Link
                                href={item.path}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors text-sm flex-1 ${
                                  active
                                    ? "bg-primary text-primary-foreground border border-primary"
                                    : "bg-white text-gray-700 border border-gray-400 hover:bg-gray-50 hover:border-gray-500"
                                }`}
                                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                <item.icon size={18} />
                                <span className="flex-1">{item.title}</span>
                              </Link>
                              <button
                                onClick={(e) => { e.preventDefault(); toggleExpanded(item.title); }}
                                className={`ml-1 p-1.5 rounded-md transition-colors ${
                                  active
                                    ? "text-primary-foreground hover:bg-primary/80"
                                    : "text-gray-500 hover:bg-gray-100"
                                }`}
                                data-testid={`toggle-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </div>
                            {isExpanded && item.children && (
                              <div className="ml-6 mt-1 space-y-1">
                                {item.children.map((child) => {
                                  const childActive = location === child.path;
                                  return (
                                    <Link
                                      key={child.path}
                                      href={child.path}
                                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md font-medium transition-colors text-xs ${
                                        childActive
                                          ? "bg-primary/10 text-primary border border-primary/30"
                                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-800 border border-transparent"
                                      }`}
                                      data-testid={`nav-${child.title.toLowerCase().replace(/\s+/g, "-")}`}
                                    >
                                      <child.icon size={14} />
                                      <span>{child.title}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Link
                            href={item.path}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                              active
                                ? "bg-primary text-primary-foreground border border-primary"
                                : "bg-white text-gray-700 border border-gray-400 hover:bg-gray-50 hover:border-gray-500"
                            }`}
                            data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <item.icon size={18} />
                            <span>{item.title}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  const links = role === "employer" ? employerLinks : seekerLinks;

  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarContent>
        <div className="p-4 py-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
            Transpo<span className="text-primary">Jobs</span>
          </Link>
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-4 mb-2 px-2">
            Dashboard Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-1">
              {links.map((item) => {
                const active = location === item.path;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link
                        href={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                          active
                            ? "bg-primary text-primary-foreground border border-primary"
                            : "bg-white text-gray-700 border border-gray-400 hover:bg-gray-50 hover:border-gray-500"
                        }`}
                      >
                        <item.icon size={18} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">
        <AppSidebar role={user.role} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-white dark:bg-slate-900 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="font-display font-semibold hidden sm:block capitalize">{user.role.replace('_', ' ')} Portal</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-right hidden md:block">
                <p className="font-semibold">{user.firstName} {user.lastName}</p>
                <p className="text-muted-foreground text-xs capitalize">{user.membershipTier} Tier</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => logout()} title="Logout" className="hover-elevate rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <LogOut size={18} />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
