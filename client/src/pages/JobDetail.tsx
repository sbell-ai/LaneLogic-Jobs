import { useParams, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Clock, ArrowLeft, ExternalLink, CheckCircle2, Briefcase, Building2, Star } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Job } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

function fmtLoc(job: Job) {
  return [job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ");
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", id],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) throw new Error("Job not found");
      return res.json();
    },
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/applications", {
        jobId: Number(id),
        jobSeekerId: user!.id,
        status: "pending",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ title: "Application submitted!", description: "Your application has been sent to the employer." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not submit application.", variant: "destructive" });
    },
  });

  const handleApply = () => {
    if (!user) { setLocation("/login"); return; }
    if (job?.isExternalApply && job.applyUrl) {
      window.open(job.applyUrl, "_blank");
    } else {
      applyMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center">
          <Briefcase className="text-muted-foreground mb-4" size={48} />
          <h1 className="text-2xl font-bold font-display mb-2">Job Not Found</h1>
          <Button variant="outline" onClick={() => setLocation("/jobs")}>Back to Jobs</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const locationStr = fmtLoc(job);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950 py-10">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <Button
            variant="ghost"
            className="mb-6 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/jobs")}
            data-testid="button-back-jobs"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to Jobs
          </Button>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                    {job.title.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">{job.title}</h1>
                    {job.companyName && (
                      <p className="text-base font-medium text-foreground/70 flex items-center gap-1.5 mb-2">
                        <Building2 size={15} /> {job.companyName}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {locationStr && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={15} /> {locationStr}
                        </span>
                      )}
                      {job.jobType && (
                        <Badge variant="outline" className="font-normal">{job.jobType}</Badge>
                      )}
                      {job.salary && (
                        <span className="flex items-center gap-1.5">
                          <DollarSign size={15} /> {job.salary}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock size={15} />
                        {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : "Recently posted"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {job.isExternalApply && (
                    <Badge variant="outline" className="w-fit">
                      <ExternalLink size={13} className="mr-1" /> External Application
                    </Badge>
                  )}
                  <Button
                    size="lg"
                    className="hover-elevate shadow-lg shadow-primary/20"
                    onClick={handleApply}
                    disabled={applyMutation.isPending}
                    data-testid="button-apply-job"
                  >
                    {applyMutation.isPending ? "Submitting..." : job.isExternalApply ? "Apply on Company Site" : "Apply Now"}
                    {job.isExternalApply && <ExternalLink size={16} className="ml-2" />}
                  </Button>
                  {!user && (
                    <p className="text-xs text-muted-foreground text-center">You must be logged in to apply</p>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8">
              <div>
                <h2 className="text-lg font-bold font-display mb-3">Job Description</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{job.description}</p>
              </div>

              <div>
                <h2 className="text-lg font-bold font-display mb-3">Requirements</h2>
                <div className="space-y-2">
                  {job.requirements.split("\n").map((req, i) => (
                    <div key={i} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </div>

              {job.benefits && (
                <div>
                  <h2 className="text-lg font-bold font-display mb-3">Benefits</h2>
                  <div className="space-y-2">
                    {job.benefits.split("\n").map((b, i) => (
                      <div key={i} className="flex items-start gap-2 text-muted-foreground">
                        <Star size={16} className="text-accent mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-border flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold font-display">Ready to apply?</p>
                  <p className="text-sm text-muted-foreground">
                    {user ? "Submit your application below." : "Log in to apply for this position."}
                  </p>
                </div>
                <Button
                  onClick={handleApply}
                  disabled={applyMutation.isPending}
                  data-testid="button-apply-job-bottom"
                >
                  {!user ? "Log in to Apply" : job.isExternalApply ? "Apply Externally" : "Submit Application"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
