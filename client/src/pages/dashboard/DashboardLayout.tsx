import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Briefcase, LayoutDashboard, FileText, LogOut, Users, BookOpen, Upload, CreditCard, UserPlus, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function AppSidebar({ role }: { role: string }) {
  const [location] = useLocation();

  const seekerLinks = [
    { title: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { title: "Applied Jobs", path: "/dashboard/applications", icon: Briefcase },
    { title: "My Resume", path: "/dashboard/resume", icon: FileText },
    { title: "Membership", path: "/dashboard/membership", icon: CreditCard },
  ];

  const employerLinks = [
    { title: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { title: "My Job Postings", path: "/dashboard/jobs", icon: Briefcase },
    { title: "Applicants", path: "/dashboard/applicants", icon: Users },
    { title: "Bulk Upload (CSV)", path: "/dashboard/upload", icon: Upload },
    { title: "Membership", path: "/dashboard/membership", icon: CreditCard },
  ];

  const adminLinks = [
    { title: "All Users", path: "/dashboard/admin/users", icon: Users },
    { title: "All Jobs", path: "/dashboard/admin/jobs", icon: Briefcase },
    { title: "Post a Job", path: "/dashboard/admin/post-job", icon: PlusCircle },
    { title: "Upload Jobs (CSV)", path: "/dashboard/admin/upload-jobs", icon: Upload },
    { title: "Invite Job Seeker", path: "/dashboard/admin/invite-seeker", icon: UserPlus },
    { title: "Invite Employer", path: "/dashboard/admin/invite-employer", icon: UserPlus },
    { title: "Blog Posts", path: "/dashboard/admin/blog", icon: FileText },
    { title: "Resources", path: "/dashboard/admin/resources", icon: BookOpen },
  ];

  const links = role === "admin" ? adminLinks : role === "employer" ? employerLinks : seekerLinks;

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
            {role === "admin" ? "Admin Panel" : "Dashboard Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.path}>
                    <Link href={item.path} className="flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors">
                      <item.icon size={18} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
