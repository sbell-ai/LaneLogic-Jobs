import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Briefcase, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import type { Application, Job } from "@shared/schema";

export default function Overview() {
  const { user } = useAuth();

  const { data: applications, isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
    enabled: user?.role === "job_seeker",
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: user?.role === "employer",
  });

  const appliedCount = (applications || []).filter((a) => a.jobSeekerId === user?.id).length;
  const activeJobCount = (jobs || []).filter((j) => j.employerId === user?.id).length;

  const statLoading = user?.role === "job_seeker" ? appsLoading : jobsLoading;
  const statValue = user?.role === "employer" ? activeJobCount : appliedCount;
  const statLabel = user?.role === "employer" ? "Active Jobs" : "Applied Jobs";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display mb-2">Welcome back, {user?.firstName || 'User'}!</h1>
          <p className="text-muted-foreground">Here's what's happening with your account today.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-border shadow-sm hover:shadow-md transition-shadow" data-testid="card-stat-applications">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Briefcase size={20} />
              </div>
            </div>
            {statLoading ? (
              <Skeleton className="h-8 w-12 mb-1" />
            ) : (
              <h3 className="text-2xl font-bold font-display" data-testid="text-applied-count">{statValue}</h3>
            )}
            <p className="text-sm text-muted-foreground font-medium mt-1">{statLabel}</p>
          </Card>

          <Card className="p-6 border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <FileText size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold font-display">Status</h3>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              {user?.role === 'employer' ? 'Profile Complete' : 'Resume Updated'}
            </p>
          </Card>

          <Card className="p-6 border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                <Activity size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold font-display capitalize">{user?.membershipTier}</h3>
            <p className="text-sm text-muted-foreground font-medium mt-1">Current Membership</p>
          </Card>
        </div>

        {user?.role === 'employer' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold font-display mb-2">Need to hire fast?</h3>
              <p className="text-muted-foreground">Post a new job listing to reach thousands of qualified transportation professionals.</p>
            </div>
            <Button asChild size="lg" className="shrink-0 hover-elevate">
              <Link href="/dashboard/jobs/new">Post a New Job</Link>
            </Button>
          </div>
        )}

        {user?.role === 'job_seeker' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold font-display mb-2">Stand out to employers</h3>
              <p className="text-muted-foreground">Ensure your resume is up-to-date and highlights your specific transportation certifications.</p>
            </div>
            <Button asChild size="lg" className="shrink-0 hover-elevate">
              <Link href="/dashboard/resume">Update Resume</Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
