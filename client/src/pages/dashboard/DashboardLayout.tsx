import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Briefcase, LayoutDashboard, FileText, LogOut, Users, BookOpen, Upload, CreditCard, UserPlus, PlusCircle, Palette, FileEdit, Tag, Ticket, UserCircle, FilePlus2, Share2, Database, Package, Gauge, ArrowDownToLine, ShieldCheck, MessageSquare, Mail, Clock, Bell, BarChart2, Bookmark, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

interface AdminLink {
  title: string;
  path: string;
  icon: any;
}

function AppSidebar({ role }: { role: string }) {
  const [location] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/conversations/unread-count"],
    refetchInterval: 30000,
    enabled: role !== "admin",
  });
  const unreadCount = unreadData?.count ?? 0;

  const seekerLinks = [
    { title: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { title: "Applied Jobs", path: "/dashboard/applications", icon: Briefcase },
    { title: "My Resume", path: "/dashboard/resume", icon: FileText },
    { title: "My Profile", path: "/dashboard/profile", icon: UserCircle },
    { title: "Saved Jobs", path: "/dashboard/saved", icon: Bookmark },
    { title: "Job Alerts", path: "/dashboard/alerts", icon: Bell },
    { title: "Verification", path: "/seeker/settings/verification", icon: ShieldCheck },
    { title: "Usage & Quota", path: "/dashboard/quota", icon: Gauge },
    { title: "Membership", path: "/dashboard/membership", icon: CreditCard },
    { title: "Messages", path: "/dashboard/messages", icon: MessageSquare, badge: unreadCount },
  ];

  const employerLinks = [
    { title: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { title: "My Job Postings", path: "/dashboard/jobs", icon: Briefcase },
    { title: "Applicants", path: "/dashboard/applicants", icon: Users },
    { title: "Analytics", path: "/dashboard/analytics", icon: BarChart2 },
    { title: "Find Candidates", path: "/dashboard/candidates", icon: Search },
    { title: "Bulk Upload (CSV)", path: "/dashboard/upload", icon: Upload },
    { title: "Company Profile", path: "/dashboard/profile", icon: UserCircle },
    { title: "Verification", path: "/employer/settings/verification", icon: ShieldCheck },
    { title: "Membership", path: "/dashboard/membership", icon: CreditCard },
    { title: "Messages", path: "/dashboard/messages", icon: MessageSquare, badge: unreadCount },
  ];

  const adminLinks: AdminLink[] = [
    { title: "Users", path: "/dashboard/admin/users", icon: Users },
    { title: "All Jobs", path: "/dashboard/admin/jobs", icon: Briefcase },
    { title: "Pages & Resources", path: "/dashboard/admin/pages-resources", icon: FileEdit },
    { title: "Blog Posts", path: "/dashboard/admin/blog", icon: FileText },
    { title: "Database", path: "/dashboard/admin/database", icon: Database },
    { title: "Coupons", path: "/dashboard/admin/coupons", icon: Ticket },
    { title: "Design Settings", path: "/dashboard/admin/design", icon: Palette },
    { title: "Social Publishing", path: "/dashboard/admin/social", icon: Share2 },
    { title: "Products", path: "/dashboard/admin/products", icon: Package },
    { title: "Imports", path: "/dashboard/admin/imports", icon: ArrowDownToLine },
    { title: "Employer Registry", path: "/dashboard/admin/employer-registry", icon: ShieldCheck },
    { title: "Employer Verification", path: "/dashboard/admin/verification", icon: ShieldCheck },
    { title: "Seeker Verification", path: "/dashboard/admin/seeker-verification", icon: ShieldCheck },
    { title: "Email Templates", path: "/dashboard/admin/email-templates", icon: Mail },
    { title: "Scheduled Automations", path: "/dashboard/admin/scheduled-automations", icon: Clock },
  ];

  const pagesResourcesPaths = ["/dashboard/admin/pages-resources", "/dashboard/admin/site-pages", "/dashboard/admin/custom-pages", "/dashboard/admin/resources"];
  const usersPaths = ["/dashboard/admin/users", "/dashboard/admin/users/all", "/dashboard/admin/users/job-seekers", "/dashboard/admin/users/employers"];
  const isActiveForItem = (item: AdminLink) => {
    if (item.path === "/dashboard/admin/pages-resources") {
      return pagesResourcesPaths.includes(location);
    }
    if (item.path === "/dashboard/admin/users") {
      return usersPaths.includes(location);
    }
    return location === item.path;
  };

  if (role === "admin") {
    return (
      <Sidebar className="border-r border-border bg-card">
        <SidebarContent>
          <div className="p-4 py-6 border-b border-border">
            <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight text-foreground">
              LaneLogic <span className="text-primary">Jobs</span>
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
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
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

  const links = role === "employer" ? employerLinks : seekerLinks;

  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarContent>
        <div className="p-4 py-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight text-foreground">
            LaneLogic <span className="text-primary">Jobs</span>
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
                const badge = (item as any).badge ?? 0;
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
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <item.icon size={18} />
                        <span className="flex-1">{item.title}</span>
                        {badge > 0 && (
                          <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none" data-testid="badge-unread-messages">
                            {badge}
                          </span>
                        )}
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
            <div className="flex items-center gap-3">
              {user.role === "admin" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      data-testid="button-avatar-dropdown"
                    >
                      <div className="text-sm text-right hidden md:block">
                        <p className="font-semibold leading-tight">{user.firstName} {user.lastName}</p>
                        <p className="text-muted-foreground text-xs">Admin</p>
                      </div>
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={(user as any).profileImage ?? ""} alt="Profile" />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                          {`${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "AD"}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/admin/profile" data-testid="link-my-profile" className="cursor-pointer flex items-center gap-2">
                        <UserCircle size={15} /> My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="text-red-600 dark:text-red-400 cursor-pointer flex items-center gap-2"
                      data-testid="button-sign-out"
                    >
                      <LogOut size={15} /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <div className="text-sm text-right hidden md:block">
                    <p className="font-semibold">{user.firstName} {user.lastName}</p>
                    <p className="text-muted-foreground text-xs capitalize">{user.membershipTier} Tier</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => logout()} title="Logout" className="hover-elevate rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <LogOut size={18} />
                  </Button>
                </>
              )}
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
