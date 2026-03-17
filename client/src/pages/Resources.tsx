import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAuthModal } from "@/components/AuthModal";
import type { Resource } from "@shared/schema";
import { INTRO_TRUNCATE_LENGTH } from "@shared/constants";
import { BookOpen, Lock, Unlock, Users, Briefcase, ArrowRight, LogIn } from "lucide-react";
import { motion } from "framer-motion";

const tierOrder: Record<string, number> = { free: 0, basic: 1, premium: 2 };

function canAccess(userTier: string | undefined, requiredTier: string, userRole?: string): boolean {
  if (userRole === "admin") return true;
  if (!userTier) return requiredTier === "free";
  return (tierOrder[userTier] ?? 0) >= (tierOrder[requiredTier] ?? 0);
}

const audienceLabel: Record<string, string> = {
  employer: "Employers",
  job_seeker: "Job Seekers",
  both: "Everyone",
};

const tierColors: Record<string, string> = {
  free: "bg-green-100 text-green-700 border-green-200",
  basic: "bg-blue-100 text-blue-700 border-blue-200",
  premium: "bg-purple-100 text-purple-700 border-purple-200",
};

function truncateIntro(text: string): string {
  if (text.length <= INTRO_TRUNCATE_LENGTH) return text;
  return text.slice(0, INTRO_TRUNCATE_LENGTH).trimEnd() + "\u2026";
}

function ResourceGrid({ resources, userTier, userRole }: { resources: Resource[]; userTier: string | undefined; userRole?: string }) {
  const accessible = resources.filter((r) => canAccess(userTier, r.requiredTier, userRole));
  const locked = resources.filter((r) => !canAccess(userTier, r.requiredTier, userRole));

  if (accessible.length === 0 && locked.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
        <BookOpen className="mx-auto mb-4 text-muted-foreground" size={40} />
        <h2 className="text-xl font-bold font-display mb-2">No resources yet</h2>
        <p className="text-muted-foreground">Resources are being added. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {accessible.length > 0 && (
        <div>
          <h2 className="text-xl font-bold font-display mb-5 flex items-center gap-2">
            <Unlock size={20} className="text-green-500" /> Available to You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessible.map((resource, i) => (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/resources/${resource.slug}`} className="block h-full">
                  <div
                    data-testid={`card-resource-${resource.id}`}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm hover:shadow-lg transition-all duration-200 p-6 flex flex-col h-full cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <BookOpen size={20} />
                      </div>
                      <div className="flex gap-2">
                        <Badge className={`text-xs border ${tierColors[resource.requiredTier] || ''}`}>
                          {resource.requiredTier}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {resource.targetAudience === "employer" ? (
                            <><Briefcase size={11} className="mr-1" />{audienceLabel[resource.targetAudience]}</>
                          ) : resource.targetAudience === "job_seeker" ? (
                            <><Users size={11} className="mr-1" />{audienceLabel[resource.targetAudience]}</>
                          ) : audienceLabel[resource.targetAudience]}
                        </Badge>
                      </div>
                    </div>
                    <h3 className="font-bold font-display text-lg mb-2">{resource.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-grow" data-testid={`text-resource-intro-${resource.id}`}>
                      {truncateIntro(resource.introText || resource.content || "")}
                    </p>
                    <div className="mt-4 pt-3 border-t border-border">
                      <span className="text-sm font-medium text-primary flex items-center gap-1" data-testid={`link-read-more-${resource.id}`}>
                        Read more <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <h2 className="text-xl font-bold font-display mb-5 flex items-center gap-2">
            <Lock size={20} className="text-muted-foreground" /> Upgrade to Access
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locked.map((resource) => (
              <div
                key={resource.id}
                data-testid={`card-resource-locked-${resource.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm p-6 flex flex-col h-full opacity-60 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
                  <Lock size={28} className="text-muted-foreground mb-3" />
                  <p className="text-sm font-semibold mb-3">
                    Requires <span className="capitalize">{resource.requiredTier}</span> membership
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/pricing">Upgrade Plan</Link>
                  </Button>
                </div>
                <h3 className="font-bold font-display text-lg mb-2 blur-[2px]">{resource.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 blur-[2px]">{truncateIntro(resource.introText || resource.content || "")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthGate() {
  const { open } = useAuthModal();
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Lock size={32} className="text-primary" />
      </div>
      <h2 className="text-2xl font-bold font-display mb-3" data-testid="text-resource-gate-heading">
        Members-Only Resource Library
      </h2>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        Sign in to access career guides, hiring templates, industry reports, and more — curated specifically for your role in transportation and logistics.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={() => open("login")} data-testid="button-signin-gate" className="gap-2">
          <LogIn size={16} /> Sign In
        </Button>
        <Button asChild variant="outline" data-testid="button-register-gate">
          <Link href="/register">Create Free Account</Link>
        </Button>
      </div>
    </div>
  );
}

const sectionLabel: Record<string, { label: string; icon: React.ReactNode }> = {
  employer: { label: "Employer Resources", icon: <Briefcase size={18} /> },
  job_seeker: { label: "Job Seeker Resources", icon: <Users size={18} /> },
  admin: { label: "All Resources", icon: <BookOpen size={18} /> },
};

export default function Resources() {
  const { user } = useAuth();
  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
    enabled: !!user,
  });

  const section = user ? (sectionLabel[user.role] ?? sectionLabel["job_seeker"]) : null;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-12">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-4 border border-primary/20">
              Member Resources
            </span>
            <h1 className="text-4xl font-bold font-display mb-3">Resource Library</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Career guides, hiring templates, industry reports, and more — all curated for the transportation sector.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-12 space-y-10">
          {!user ? (
            <AuthGate />
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-border h-52 animate-pulse" />
              ))}
            </div>
          ) : (
            <div>
              {section && (
                <div className="flex items-center gap-2 mb-8 text-lg font-semibold font-display text-foreground" data-testid="text-resources-section-label">
                  {section.icon}
                  {section.label}
                </div>
              )}
              <ResourceGrid resources={resources || []} userTier={user.membershipTier} userRole={user.role} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
