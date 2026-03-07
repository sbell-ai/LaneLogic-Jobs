import { useMemo } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Briefcase, DollarSign, ExternalLink, Clock, Building2, Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fmtLoc } from "@/components/JobFilterSidebar";

const US_STATES: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi", mo: "Missouri",
  mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire", nj: "New Jersey",
  nm: "New Mexico", ny: "New York", nc: "North Carolina", nd: "North Dakota", oh: "Ohio",
  ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania", ri: "Rhode Island", sc: "South Carolina",
  sd: "South Dakota", tn: "Tennessee", tx: "Texas", ut: "Utah", vt: "Vermont",
  va: "Virginia", wa: "Washington", wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming",
  dc: "District of Columbia",
};

const STATE_ABBREV: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new-hampshire": "NH", "new-jersey": "NJ",
  "new-mexico": "NM", "new-york": "NY", "north-carolina": "NC", "north-dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode-island": "RI", "south-carolina": "SC",
  "south-dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west-virginia": "WV", wisconsin: "WI", wyoming: "WY",
  dc: "DC", "district-of-columbia": "DC",
};

function slugToDisplay(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function matchesState(job: Job, stateSlug: string): boolean {
  const locState = job.locationState || "";
  const parts = locState.split(/[,\s]+/).map((p) => p.replace(/[^a-zA-Z]/g, "").toLowerCase()).filter(Boolean);

  const abbrev = STATE_ABBREV[stateSlug];
  if (abbrev && parts.some((p) => p === abbrev.toLowerCase())) return true;

  const fullName = (US_STATES[stateSlug] || slugToDisplay(stateSlug)).toLowerCase();
  if (parts.some((p) => p === fullName)) return true;

  const fullNameParts = fullName.split(" ");
  if (fullNameParts.length > 1) {
    const joined = fullNameParts.join("");
    if (parts.some((p) => p === joined)) return true;
    if (locState.toLowerCase().includes(fullName)) return true;
  }

  return false;
}

function matchesJobType(job: Job, jobTypeSlug: string): boolean {
  const slug = jobTypeSlug.toLowerCase().replace(/-/g, " ");
  const title = job.title?.toLowerCase() || "";
  const category = (job as any).category?.toLowerCase() || "";
  const jobType = job.jobType?.toLowerCase() || "";
  const desc = job.description?.toLowerCase() || "";
  return (
    title.includes(slug) ||
    category.includes(slug) ||
    jobType.includes(slug) ||
    desc.includes(slug)
  );
}

export default function JobsByTypeAndState() {
  const params = useParams<{ jobType: string; state: string }>();
  const jobTypeSlug = params.jobType || "";
  const stateSlug = params.state || "";

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const filtered = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter(
      (job) => matchesJobType(job, jobTypeSlug) && matchesState(job, stateSlug)
    );
  }, [jobs, jobTypeSlug, stateSlug]);

  const jobTypeLabel = slugToDisplay(jobTypeSlug);
  const stateLabel = US_STATES[stateSlug] || slugToDisplay(stateSlug);
  const pageTitle = `${jobTypeLabel} Jobs in ${stateLabel}`;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-6">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Truck size={28} className="text-primary" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-jobs-type-state-heading">
                  {pageTitle}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isLoading
                    ? "Loading..."
                    : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} found`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border h-36 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
                <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
                <h2 className="text-xl font-bold font-display mb-2" data-testid="text-no-jobs-found">No jobs found</h2>
                <p className="text-muted-foreground mb-4">
                  No {jobTypeLabel.toLowerCase()} jobs are currently available in {stateLabel}.
                </p>
                <Link href="/jobs">
                  <Button variant="outline" data-testid="button-browse-all-jobs">
                    Browse All Jobs
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((job, i) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link href={`/jobs/${job.id}`}>
                      <div
                        data-testid={`card-job-${job.id}`}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 cursor-pointer group"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {(job as any).employerLogo ? (
                              <img src={(job as any).employerLogo} alt={job.companyName || ""} className="w-12 h-12 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" data-testid={`img-company-logo-${job.id}`} />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0" data-testid={`placeholder-company-logo-${job.id}`}>
                                {(job.companyName || job.title).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h2 className="text-lg font-bold font-display group-hover:text-primary transition-colors">
                                {job.title}
                              </h2>
                              {job.companyName && (
                                <p className="text-sm font-medium text-foreground/70 flex items-center gap-1 mt-0.5">
                                  <Building2 size={13} /> {job.companyName}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                                {fmtLoc(job) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={14} /> {fmtLoc(job)}
                                  </span>
                                )}
                                {job.jobType && (
                                  <Badge variant="outline" className="text-xs font-normal">{job.jobType}</Badge>
                                )}
                                {job.salary && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign size={14} /> {job.salary}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : "Recently"}
                                </span>
                                {job.expiresAt && (
                                  <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-semibold hover:bg-amber-100" data-testid={`badge-actively-interviewing-${job.id}`}>
                                    Actively Interviewing: Apply Soon
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.isExternalApply && (
                              <Badge variant="outline" className="text-xs">
                                <ExternalLink size={12} className="mr-1" /> External
                              </Badge>
                            )}
                            <Button size="sm" className="hover-elevate" data-testid={`button-apply-${job.id}`}>
                              Apply Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
