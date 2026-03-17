import { useState, useEffect } from "react";
import { Switch, Route, useLocation, useParams, Redirect } from "wouter";
import { updateHistory } from "@/lib/navigationHistory";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { useCanonical } from "@/hooks/use-canonical";
import { AuthModalProvider, useAuthModal } from "@/components/AuthModal";

import Home from "@/pages/Home";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Resources from "@/pages/Resources";
import Pricing from "@/pages/Pricing";
import Employers from "@/pages/Employers";
import EmployerProfile from "@/pages/EmployerProfile";
import Contact from "@/pages/Contact";
import JobsByTypeAndState from "@/pages/JobsByTypeAndState";
import ResourceDetail from "@/pages/ResourceDetail";
import DynamicPage from "@/pages/DynamicPage";
import GuidePage from "@/pages/GuidePage";
import type { Page } from "@shared/schema";
import { findCategoryBySlug, US_STATES } from "@/config/jobCategories";

import Overview from "@/pages/dashboard/Overview";
import JobSeekerDashboard from "@/pages/dashboard/JobSeekerDashboard";
import EmployerDashboard from "@/pages/dashboard/EmployerDashboard";
import AdminDashboard from "@/pages/dashboard/AdminDashboard";
import DesignSettings from "@/pages/dashboard/DesignSettings";
import InboxPage from "@/pages/dashboard/Inbox";
import VerificationPage from "@/pages/employer/VerificationPage";
import SeekerVerificationPage from "@/pages/seeker/SeekerVerificationPage";

function ThemeInjector() {
  useSettings();
  useCanonical();
  return null;
}

function LoginRedirect() {
  const { open } = useAuthModal();
  const [, navigate] = useLocation();
  useState(() => { open("login"); navigate("/", { replace: true }); });
  return null;
}

function RegisterRedirect() {
  const { open } = useAuthModal();
  const [, navigate] = useLocation();
  useState(() => { open("signup"); navigate("/", { replace: true }); });
  return null;
}

function DashboardRouter() {
  const { user, isLoading } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [, nav] = useLocation();
  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) { openAuth("login"); nav("/", { replace: true }); return null; }

  if (user.role === "admin") return <AdminDashboard section="users" />;
  if (user.role === "employer") return <EmployerDashboard />;
  return <Overview />;
}

function DashboardSectionRouter({ params }: { params: { section: string } }) {
  const { user, isLoading } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [, nav] = useLocation();
  if (isLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) { openAuth("login"); nav("/", { replace: true }); return null; }

  if (user.role === "employer") return <EmployerDashboard section={params.section} />;
  return <JobSeekerDashboard section={params.section} />;
}

function AdminSectionRouter({ params }: { params: { section: string } }) {
  if (params.section === "design") return <DesignSettings />;
  return <AdminDashboard section={params.section} />;
}

function AdminSubSectionRouter({ params }: { params: { section: string; subsection: string } }) {
  return <AdminDashboard section={params.section} subsection={params.subsection} />;
}

function JobDetailOrSeoPage() {
  const routeParams = useParams<{ id: string }>();
  const param = routeParams.id || "";

  if (/^\d+$/.test(param)) {
    return <JobDetail />;
  }

  return <SeoJobPageOrFallthrough />;
}

function SeoJobPageOrFallthrough() {
  const routeParams = useParams<{ id?: string; seoSlug?: string }>();
  const rawSlug = routeParams.id || routeParams.seoSlug || "";
  const slug = rawSlug.toLowerCase().replace(/\/+$/, "");

  if (slug !== rawSlug) {
    return <Redirect to={`/jobs/${slug}`} />;
  }

  if (!slug.includes("-jobs-")) {
    return <CmsOrNotFound />;
  }

  const parts = slug.split("-jobs-");
  if (parts.length !== 2) {
    return <CmsOrNotFound />;
  }

  const [categorySlug, stateSlug] = parts;
  const category = findCategoryBySlug(categorySlug);
  const stateExists = Object.prototype.hasOwnProperty.call(US_STATES, stateSlug);

  if (!category || !stateExists) {
    return <CmsOrNotFound />;
  }

  return <JobsByTypeAndState seoSlug={slug} />;
}

function LegacySeoRedirect() {
  const routeParams = useParams<{ seoSlug: string }>();
  const rawSlug = routeParams.seoSlug || "";
  const slug = rawSlug.toLowerCase().replace(/\/+$/, "");

  if (!slug.includes("-jobs-")) {
    return <CmsOrNotFound />;
  }

  const parts = slug.split("-jobs-");
  if (parts.length !== 2) {
    return <CmsOrNotFound />;
  }

  const [categorySlug, stateSlug] = parts;
  const category = findCategoryBySlug(categorySlug);
  const stateExists = Object.prototype.hasOwnProperty.call(US_STATES, stateSlug);

  if (!category || !stateExists) {
    return <CmsOrNotFound />;
  }

  return <Redirect to={`/jobs/${slug}`} />;
}

function CmsOrNotFound() {
  const [location] = useLocation();
  const slug = location.replace(/^\//, "").replace(/\/$/, "");

  const { data: page, isLoading, error } = useQuery<Page>({
    queryKey: ["/api/pages/slug", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/slug/${slug}`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    enabled: !!slug && !slug.includes("/"),
    retry: false,
  });

  if (!slug || slug.includes("/")) return <NotFound />;
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (error || !page) return <NotFound />;
  return <DynamicPage slug={slug} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginRedirect} />
      <Route path="/register" component={RegisterRedirect} />

      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:id" component={JobDetailOrSeoPage} />
      <Route path="/employers" component={Employers} />
      <Route path="/employers/:id" component={EmployerProfile} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:id" component={BlogPost} />
      <Route path="/resources/:slug" component={ResourceDetail} />
      <Route path="/resources" component={Resources} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/contact" component={Contact} />

      <Route path="/guides/:slug" component={GuidePage} />
      <Route path="/pages/:slug" component={DynamicPage} />

      <Route path="/employer/settings/verification" component={VerificationPage} />
      <Route path="/seeker/settings/verification" component={SeekerVerificationPage} />

      <Route path="/dashboard" component={DashboardRouter} />
      <Route path="/dashboard/messages" component={InboxPage} />
      <Route path="/dashboard/:section" component={DashboardSectionRouter} />
      <Route path="/dashboard/admin/:section/:subsection" component={AdminSubSectionRouter} />
      <Route path="/dashboard/admin/:section" component={AdminSectionRouter} />

      <Route path="/:seoSlug" component={LegacySeoRedirect} />
      <Route component={CmsOrNotFound} />
    </Switch>
  );
}

function NavigationTracker() {
  const [location] = useLocation();
  useEffect(() => {
    updateHistory(location);
  }, [location]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthModalProvider>
          <ThemeInjector />
          <NavigationTracker />
          <Toaster />
          <Router />
        </AuthModalProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
