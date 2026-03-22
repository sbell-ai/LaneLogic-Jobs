import { useParams, useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Clock, ExternalLink, CheckCircle2, Briefcase, Building2, Star, MessageSquare, Bookmark, BookmarkCheck } from "lucide-react";
import type { SavedJob } from "@shared/schema";
import { BackButton } from "@/components/nav/BackButton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { EnrichedJob } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import MarkdownDescription from "@/components/MarkdownDescription";
import { formatJobLocation } from "@/components/JobFilterSidebar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

function fmtLoc(job: EnrichedJob) {
  return formatJobLocation(job);
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery<EnrichedJob>({
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

  const messageMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/conversations", {
        seekerId: user!.id,
        employerId: job!.employerId,
        jobId: Number(id),
      }).then((r) => r.json()),
    onSuccess: (conv: any) => {
      setLocation(`/dashboard/messages?conv=${conv.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not open conversation.", variant: "destructive" });
    },
  });

  const { data: savedJobs = [] } = useQuery<SavedJob[]>({
    queryKey: ["/api/saved-jobs"],
    enabled: !!user && user.role === "job_seeker",
  });
  const isSaved = savedJobs.some((s) => s.jobId === Number(id));

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/saved-jobs", { jobId: Number(id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-jobs"] });
      toast({ title: "Job saved", description: "Added to your saved jobs." });
    },
  });
  const unsaveMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/saved-jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-jobs"] });
      toast({ title: "Removed", description: "Job removed from saved jobs." });
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

  const canMessageEmployer =
    user &&
    user.role === "job_seeker" &&
    job?.employerIsRegistered &&
    job?.employerVerificationStatus === "verified";

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
        <div className="flex-grow flex flex-col items-center justify-center px-4 text-center">
          <Briefcase className="text-muted-foreground mb-4" size={48} />
          <h1 className="text-2xl font-bold font-display mb-4" data-testid="text-job-not-found">
            That job no longer exists.
          </h1>
          <p className="text-lg mb-2">
            Search new jobs here: <Link href="/jobs" className="inline-flex items-center gap-1 text-primary underline font-semibold" data-testid="link-search-jobs">🔶➡️</Link>
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  const locationStr = fmtLoc(job);

  const siteUrl = "https://lanelogicjobs.com";
  const jobUrl = `${siteUrl}/jobs/${job.id}`;

  const jobSchema: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": job.title,
    "description": job.description || "",
    "identifier": { "@type": "PropertyValue", "name": job.companyName || "LaneLogic Jobs", "value": String(job.id) },
    "datePosted": job.createdAt ? new Date(job.createdAt).toISOString().split("T")[0] : undefined,
    "validThrough": job.expiresAt ? new Date(job.expiresAt).toISOString().split("T")[0] : undefined,
    "employmentType": (() => {
      const typeMap: Record<string, string> = {
        full_time: "FULL_TIME", part_time: "PART_TIME", contract: "CONTRACTOR",
        temporary: "TEMPORARY", seasonal: "TEMPORARY", internship: "INTERN",
      };
      return job.jobType ? typeMap[job.jobType] || "OTHER" : undefined;
    })(),
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.companyName || "LaneLogic Jobs",
      ...(job.employerLogo ? { "logo": job.employerLogo } : {}),
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        ...(job.locationCity ? { "addressLocality": job.locationCity } : {}),
        ...(job.locationState ? { "addressRegion": job.locationState } : {}),
        "addressCountry": "US",
      },
    },
    ...(job.workLocationType === "remote" ? { "jobLocationType": "TELECOMMUTE" } : {}),
    ...(job.salary ? { "baseSalary": { "@type": "MonetaryAmount", "currency": "USD", "value": { "@type": "QuantitativeValue", "value": job.salary, "unitText": "YEAR" } } } : {}),
    "url": jobUrl,
    "applyLink": job.applyUrl || jobUrl,
  };

  // Remove undefined values
  Object.keys(jobSchema).forEach(k => { if (jobSchema[k] === undefined) delete jobSchema[k]; });

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobSchema) }} />
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950 py-10">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <BackButton fallback="/jobs" />

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-8 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex items-start gap-5">
                  {job.employerLogo ? (
                    <img src={job.employerLogo} alt={job.companyName || ""} className="w-16 h-16 rounded-2xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" data-testid="img-company-logo" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-bold text-2xl shrink-0" data-testid="placeholder-company-logo">
                      {(job.title || job.companyName || "J").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">{job.title}</h1>
                    {job.companyName && (
                      <p className="text-base font-medium text-foreground/70 flex items-center gap-1.5 mb-2">
                        <Building2 size={15} /> {job.companyName}
                        {job.employerVerificationStatus === "approved" && (
                          <VerifiedBadge type="employer" size="sm" />
                        )}
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
                      {job.expiresAt && (
                        <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs font-semibold hover:bg-amber-100" data-testid="badge-actively-interviewing">
                          Actively Interviewing: Apply Soon
                        </Badge>
                      )}
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
                  {canMessageEmployer && (
                    <Button
                      variant="outline"
                      onClick={() => messageMutation.mutate()}
                      disabled={messageMutation.isPending}
                      data-testid="button-message-employer"
                      className="gap-2"
                    >
                      <MessageSquare size={16} />
                      {messageMutation.isPending ? "Opening..." : "Message Employer"}
                    </Button>
                  )}
                  {user?.role === "job_seeker" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => isSaved ? unsaveMutation.mutate() : saveMutation.mutate()}
                      disabled={saveMutation.isPending || unsaveMutation.isPending}
                      data-testid="button-save-job"
                      className="gap-2"
                    >
                      {isSaved ? <><BookmarkCheck size={15} /> Saved</> : <><Bookmark size={15} /> Save Job</>}
                    </Button>
                  )}
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
                <MarkdownDescription content={job.description} className="text-muted-foreground" />
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
