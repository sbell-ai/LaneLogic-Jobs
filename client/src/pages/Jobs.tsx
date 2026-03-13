import { useState } from "react";
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
  JobFilterSidebar, MobileFilterButton, useJobFilters, filterJobs, getActiveFilterCount, clearAllFilters, fmtLoc,
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
                    {isLoading ? "Loading..." : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} found`}
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
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border h-36 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
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
                                  {(job.title || job.companyName || "J").charAt(0).toUpperCase()}
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
