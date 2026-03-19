import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Briefcase, DollarSign, ExternalLink, Clock, Building2, Truck, RotateCcw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Job, Category } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  JobFilterSidebar, MobileFilterButton, useJobFilters, filterJobs, getActiveFilterCount, clearAllFilters, formatJobLocation,
} from "@/components/JobFilterSidebar";

export default function Jobs() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const filters = useJobFilters(params.get("q") || "", params.get("loc") || "");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const industries = (categories || []).filter((c) => c.type === "industry");
  const filtered = filterJobs(jobs || [], filters);
  const activeFilterCount = getActiveFilterCount(filters);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const job of filtered) {
      const key = (job.companyName || "").trim().toLowerCase() || `__noc_${(job as any).employerId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(job);
    }
    for (const jobs of groups.values())
      jobs.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return Array.from(groups.values()).sort((a, b) =>
      new Date(b[0].createdAt ?? 0).getTime() - new Date(a[0].createdAt ?? 0).getTime()
    );
  }, [filtered]);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-6">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck size={28} className="text-primary" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-jobs-heading">Browse Transportation Jobs</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isLoading ? "Loading..." : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} at ${grouped.length} ${grouped.length !== 1 ? "companies" : "company"}`}
                  </p>
                </div>
              </div>
              <MobileFilterButton filters={filters} onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)} />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="flex gap-6">
            <JobFilterSidebar
              filters={filters}
              filteredCount={filtered.length}
              industries={industries}
              mobileOpen={mobileFiltersOpen}
              onMobileClose={() => setMobileFiltersOpen(false)}
            />

            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-border shadow-sm animate-pulse flex flex-col gap-3 min-h-[14rem]">
                      <div className="w-12 h-12 rounded-xl bg-muted" />
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-2/3 mt-auto" />
                    </div>
                  ))}
                </div>
              ) : grouped.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
                  <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
                  <h2 className="text-xl font-bold font-display mb-2">No jobs found</h2>
                  <p className="text-muted-foreground mb-4">Try adjusting your search filters.</p>
                  {activeFilterCount > 0 && (
                    <Button variant="outline" onClick={() => clearAllFilters(filters)} data-testid="button-clear-filters-empty">
                      <RotateCcw size={14} className="mr-2" /> Clear all filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {grouped.map((group, i) => {
                    const job = group[0];
                    const extraCount = group.length - 1;
                    const employerId = (job as any).employerId as number;
                    return (
                      <motion.div
                        key={job.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      >
                        <div
                          data-testid={`card-job-${job.id}`}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-200 group h-full flex flex-col"
                        >
                          <Link href={`/jobs/${job.id}`} className="p-5 flex flex-col flex-1 cursor-pointer">
                            {(job as any).employerLogo ? (
                              <img src={(job as any).employerLogo} alt={job.companyName || ""} className="w-12 h-12 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0 mb-3" data-testid={`img-company-logo-${job.id}`} />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg shrink-0 mb-3" data-testid={`placeholder-company-logo-${job.id}`}>
                                {(job.title || job.companyName || "J").charAt(0).toUpperCase()}
                              </div>
                            )}

                            <h2 className="text-base font-bold font-display group-hover:text-primary transition-colors line-clamp-2">
                              {job.title}
                            </h2>
                            {job.companyName && (
                              <p className="text-sm font-medium text-foreground/70 flex items-center gap-1 mt-1">
                                <Building2 size={13} className="shrink-0" /> <span className="line-clamp-1">{job.companyName}</span>
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {formatJobLocation(job) && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={12} /> <span className="line-clamp-1">{formatJobLocation(job)}</span>
                                </span>
                              )}
                              {job.jobType && (
                                <Badge variant="outline" className="text-[10px] font-normal">{job.jobType}</Badge>
                              )}
                              {job.salary && (
                                <span className="flex items-center gap-1">
                                  <DollarSign size={12} /> {job.salary}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : "Recently"}
                              </span>
                              {job.expiresAt && (
                                <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-semibold hover:bg-amber-100" data-testid={`badge-actively-interviewing-${job.id}`}>
                                  Actively Interviewing
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-col items-start gap-2 mt-auto pt-3">
                              {job.isExternalApply && (
                                <Badge variant="outline" className="text-[10px]">
                                  <ExternalLink size={10} className="mr-1" /> External Apply
                                </Badge>
                              )}
                              <Button size="sm" className="hover-elevate" data-testid={`button-apply-${job.id}`}>
                                Apply Now
                              </Button>
                            </div>
                          </Link>
                          {extraCount > 0 && (job as any).employerHasProfile && (
                            <Link
                              href={`/employers/${employerId}`}
                              className="mx-5 mb-4 flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline -mt-1"
                              data-testid={`link-more-jobs-${job.id}`}
                            >
                              <Building2 size={12} />
                              See {extraCount} more {extraCount === 1 ? "job" : "jobs"} from {job.companyName} →
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
