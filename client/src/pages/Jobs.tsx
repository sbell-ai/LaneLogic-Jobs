import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Briefcase, DollarSign, ExternalLink, Clock, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Job, Category } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

function fmtLoc(job: Job) {
  return [job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ");
}

export default function Jobs() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [query, setQuery] = useState(params.get("q") || "");
  const [locationFilter, setLocationFilter] = useState(params.get("loc") || "");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const jobCategories = (categories || []).filter((c) => c.type === "job");
  const industries = (categories || []).filter((c) => c.type === "industry");

  const filtered = (jobs || []).filter((job) => {
    const matchQuery =
      !query ||
      job.title.toLowerCase().includes(query.toLowerCase()) ||
      job.description.toLowerCase().includes(query.toLowerCase()) ||
      (job.companyName || "").toLowerCase().includes(query.toLowerCase());
    const loc = fmtLoc(job).toLowerCase();
    const matchLoc = !locationFilter || loc.includes(locationFilter.toLowerCase());
    const matchType = jobTypeFilter === "all" || (job.jobType || "").toLowerCase() === jobTypeFilter.toLowerCase();
    const matchCategory = categoryFilter === "all" || (job.category || "").toLowerCase() === categoryFilter.toLowerCase();
    const matchIndustry = industryFilter === "all" || (job.industry || "").toLowerCase() === industryFilter.toLowerCase();
    return matchQuery && matchLoc && matchType && matchCategory && matchIndustry;
  });

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        {/* Search Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-border py-8">
          <div className="container mx-auto px-4 md:px-6">
            <h1 className="text-3xl font-bold font-display mb-6">Browse Transportation Jobs</h1>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  data-testid="input-job-search"
                  placeholder="Job title, keywords, or company"
                  className="pl-10 h-11"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  data-testid="input-location-search"
                  placeholder="City, state, or country"
                  className="pl-10 h-11"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                />
              </div>
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger data-testid="select-job-type" className="h-11 w-full md:w-[180px]">
                  <SelectValue placeholder="Job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                  <SelectItem value="Owner-Operator">Owner-Operator</SelectItem>
                  <SelectItem value="Lease Purchase">Lease Purchase</SelectItem>
                  <SelectItem value="Temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category" className="h-11 w-full md:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {jobCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger data-testid="select-industry" className="h-11 w-full md:w-[180px]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <p className="text-muted-foreground text-sm">
              {isLoading ? "Loading..." : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

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
              <p className="text-muted-foreground">Try adjusting your search filters.</p>
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
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                            {job.title.charAt(0)}
                          </div>
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
      </main>
      <Footer />
    </div>
  );
}
