import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Resource } from "@shared/schema";
import { BookOpen, Lock, Unlock, Users, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";

const tierOrder: Record<string, number> = { free: 0, basic: 1, premium: 2 };

function canAccess(userTier: string | undefined, requiredTier: string): boolean {
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

function ResourceGrid({ resources, userTier }: { resources: Resource[]; userTier: string | undefined }) {
  const accessible = resources.filter((r) => canAccess(userTier, r.requiredTier));
  const locked = resources.filter((r) => !canAccess(userTier, r.requiredTier));

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
                <div
                  data-testid={`card-resource-${resource.id}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm hover:shadow-lg transition-all duration-200 p-6 flex flex-col h-full"
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
                  <p className="text-sm text-muted-foreground leading-relaxed flex-grow">{resource.content}</p>
                </div>
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
                <p className="text-sm text-muted-foreground line-clamp-3 blur-[2px]">{resource.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Resources() {
  const { user } = useAuth();
  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
  });

  const defaultTab = user?.role === "employer" ? "employer" : "job_seeker";

  const employerResources = useMemo(
    () => (resources || []).filter((r) => r.targetAudience === "employer" || r.targetAudience === "both"),
    [resources]
  );

  const jobSeekerResources = useMemo(
    () => (resources || []).filter((r) => r.targetAudience === "job_seeker" || r.targetAudience === "both"),
    [resources]
  );

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
            {!user && (
              <div className="mt-6">
                <Button asChild className="mr-3">
                  <Link href="/register">Sign Up Free</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/pricing">View Membership Plans</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-12 space-y-10">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-border h-52 animate-pulse" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList className="mb-8" data-testid="tabs-resource-audience">
                <TabsTrigger value="employer" data-testid="tab-employer">
                  <Briefcase size={14} className="mr-1.5" />
                  For Employers
                </TabsTrigger>
                <TabsTrigger value="job_seeker" data-testid="tab-job-seeker">
                  <Users size={14} className="mr-1.5" />
                  For Job Seekers
                </TabsTrigger>
              </TabsList>
              <TabsContent value="employer">
                <ResourceGrid resources={employerResources} userTier={user?.membershipTier} />
              </TabsContent>
              <TabsContent value="job_seeker">
                <ResourceGrid resources={jobSeekerResources} userTier={user?.membershipTier} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
