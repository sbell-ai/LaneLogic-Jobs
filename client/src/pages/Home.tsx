import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Search, MapPin, Briefcase, ArrowRight, ShieldCheck, Users, ChevronDown, Filter, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { useJobs } from "@/hooks/use-jobs";
import { useSiteSettings } from "@/hooks/use-settings";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@shared/schema";
import {
  JobFilterSidebar, MobileFilterButton, useJobFilters, filterJobs, getActiveFilterCount, clearAllFilters, formatJobLocation,
} from "@/components/JobFilterSidebar";

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [visibleJobCount, setVisibleJobCount] = useState(12);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const settings = useSiteSettings();
  const { data: jobs, isLoading } = useJobs();
  const filters = useJobFilters();

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const industries = (categories || []).filter((c) => c.type === "industry");
  const filtered = filterJobs(jobs || [], filters);
  const activeFilterCount = getActiveFilterCount(filters);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (locationQuery) params.set("loc", locationQuery);
    setLocation(`/jobs?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-grow">
        {!settings.heroHidden && <section
          className={`relative overflow-hidden ${!settings.heroBgColor ? 'bg-slate-50 dark:bg-slate-950' : ''} ${
            (() => {
              const hasHeading = !!settings.heroHeading?.trim();
              const hasSubtext = !!settings.heroSubtext?.trim();
              const hasBadge = !!settings.heroBadge?.trim();
              const contentCount = [hasHeading, hasSubtext, hasBadge].filter(Boolean).length;
              if (contentCount === 0) return "pt-8 pb-10";
              if (settings.heroSize === "compact") return "pt-10 pb-14";
              if (settings.heroSize === "large") return "pt-28 pb-40";
              if (contentCount <= 1) return "pt-12 pb-16";
              return "pt-20 pb-32";
            })()
          }`}
          style={{
            ...(settings.heroBgColor ? { backgroundColor: settings.heroBgColor } : {}),
            ...(settings.heroBorderColor ? { borderBottom: `2px solid ${settings.heroBorderColor}` } : {}),
          }}
        >
          <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.08]" 
               style={{ backgroundImage: 'radial-gradient(#1d4ed8 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
          </div>
          
          <div className="container relative z-10 mx-auto px-4 md:px-6" style={settings.heroFontColor ? { color: settings.heroFontColor } : undefined}>
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {settings.heroBadge?.trim() && (
                  <span className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-6 border border-primary/20" data-testid="text-hero-badge">
                    {settings.heroBadge}
                  </span>
                )}
                {settings.heroHeading?.trim() && (
                  <h1 className={`font-bold font-display leading-tight tracking-tighter mb-6 text-balance ${!settings.heroFontColor ? 'text-foreground' : ''} ${
                    settings.heroSize === "compact" ? "text-3xl md:text-5xl" :
                    settings.heroSize === "large" ? "text-5xl md:text-7xl" :
                    "text-4xl md:text-6xl"
                  }`} data-testid="text-hero-heading">
                    {settings.heroHeading}
                  </h1>
                )}
                {settings.heroSubtext?.trim() && (
                  <p className={`text-lg md:text-xl mb-10 max-w-2xl mx-auto text-balance ${!settings.heroFontColor ? 'text-muted-foreground' : 'opacity-80'}`} data-testid="text-hero-subtext">
                    {settings.heroSubtext}
                  </p>
                )}
              </motion.div>

              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                onSubmit={handleSearch}
                className="glass-card p-2 rounded-2xl flex flex-col md:flex-row gap-2 max-w-3xl mx-auto relative z-20"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input 
                    placeholder="Job title, keywords, or company" 
                    className="pl-10 border-0 bg-transparent h-12 text-base focus-visible:ring-0 shadow-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="hidden md:block w-px bg-border my-2"></div>
                <div className="relative flex-1 border-t md:border-t-0 border-border">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <Input 
                    placeholder="City, state, or zip code" 
                    className="pl-10 border-0 bg-transparent h-12 text-base focus-visible:ring-0 shadow-none"
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                  />
                </div>
                <Button type="submit" size="lg" className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-base hover-elevate shadow-lg shadow-primary/25">
                  Search Jobs
                </Button>
              </motion.form>
              
              {(() => {
                const searches = (settings.heroPopularSearches || "").split(",").map(s => s.trim()).filter(Boolean);
                return searches.length > 0 ? (
                  <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground" data-testid="hero-popular-searches">
                    <span className="font-medium">Popular:</span>
                    {searches.map(term => (
                      <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`} className="hover:text-primary transition-colors">{term}</Link>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </section>}

        <section className="py-16 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-4">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold font-display tracking-tight text-foreground mb-2" data-testid="text-all-jobs-heading">All Jobs</h2>
                <p className="text-muted-foreground text-lg">
                  {isLoading ? "Loading..." : `${filtered.length} openings in transportation and logistics.`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <MobileFilterButton filters={filters} onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)} />
                <Button asChild variant="ghost" className="hidden md:flex hover-elevate">
                  <Link href="/jobs" className="group">
                    View all <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex gap-6">
              <JobFilterSidebar
                filters={filters}
                filteredCount={filtered.length}
                industries={industries}
                mobileOpen={mobileFiltersOpen}
                onMobileClose={() => setMobileFiltersOpen(false)}
              />

              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {isLoading ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="bg-card rounded-2xl p-5 border border-border h-48 animate-pulse" />
                    ))
                  ) : filtered.length > 0 ? (
                    filtered.slice(0, visibleJobCount).map(job => (
                      <Link key={job.id} href={`/jobs/${job.id}`} data-testid={`card-job-${job.id}`}>
                        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 h-full flex flex-col group cursor-pointer">
                          <div className="flex items-start justify-between mb-3">
                            {(job as any).employerLogo ? (
                              <img src={(job as any).employerLogo} alt={job.companyName || ""} className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" data-testid={`img-company-logo-${job.id}`} />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-lg font-bold text-white shrink-0" data-testid={`placeholder-company-logo-${job.id}`}>
                                {(job.title || job.companyName || "J").charAt(0).toUpperCase()}
                              </div>
                            )}
                            {job.jobType && (
                              <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                                {job.jobType}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold font-display mb-1 group-hover:text-primary transition-colors line-clamp-1" data-testid={`text-job-title-${job.id}`}>{job.title}</h3>
                          {job.companyName && (
                            <p className="text-sm text-muted-foreground mb-2">{job.companyName}</p>
                          )}
                          <div className="flex items-center text-muted-foreground text-xs mb-3">
                            <MapPin size={14} className="mr-1 shrink-0" />
                            <span className="line-clamp-1">{formatJobLocation(job)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-auto">
                            {job.salary && (
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400" data-testid={`text-job-salary-${job.id}`}>
                                {job.salary}
                              </span>
                            )}
                            {job.expiresAt && (
                              <span className="ml-auto px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold rounded-full whitespace-nowrap" data-testid={`badge-actively-interviewing-${job.id}`}>
                                Actively Interviewing: Apply Soon
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-border">
                      <Briefcase className="mx-auto mb-3 text-muted-foreground" size={32} />
                      <p className="text-muted-foreground mb-3">No jobs match your filters.</p>
                      {activeFilterCount > 0 && (
                        <Button variant="outline" size="sm" onClick={() => clearAllFilters(filters)} data-testid="button-clear-filters-home-empty">
                          <RotateCcw size={14} className="mr-2" /> Clear all filters
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {!isLoading && filtered.length > visibleJobCount && (
                  <div className="mt-8 text-center">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 rounded-xl hover-elevate"
                      onClick={() => setVisibleJobCount(prev => prev + 12)}
                      data-testid="button-show-more-jobs"
                    >
                      <ChevronDown size={18} />
                      Show More Jobs
                    </Button>
                  </div>
                )}

                <div className="mt-8 text-center md:hidden">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/jobs">View all jobs</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {(() => {
          const features = [
            { title: settings.feature1Title, desc: settings.feature1Description, icon: <Briefcase size={32} />, bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-primary", tid: "1" },
            { title: settings.feature2Title, desc: settings.feature2Description, icon: <Users size={32} />, bg: "bg-orange-100 dark:bg-orange-900/30", color: "text-accent", tid: "2" },
            { title: settings.feature3Title, desc: settings.feature3Description, icon: <ShieldCheck size={32} />, bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600", tid: "3" },
          ].filter(f => f.title?.trim() || f.desc?.trim());
          return features.length > 0 ? (
            <section className="py-20 bg-white dark:bg-slate-900 border-y border-border/50">
              <div className="container mx-auto px-4 md:px-6">
                <div className={`grid grid-cols-1 ${features.length === 1 ? "max-w-md mx-auto" : features.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"} gap-8`}>
                  {features.map(f => (
                    <div key={f.tid} className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className={`w-16 h-16 rounded-2xl ${f.bg} flex items-center justify-center ${f.color} mb-6`}>
                        {f.icon}
                      </div>
                      {f.title?.trim() && <h3 className="text-xl font-bold font-display mb-3" data-testid={`text-feature${f.tid}-title`}>{f.title}</h3>}
                      {f.desc?.trim() && <p className="text-muted-foreground" data-testid={`text-feature${f.tid}-desc`}>{f.desc}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null;
        })()}

        
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src={settings.ctaBackgroundImage || "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1920&h=1080&fit=crop"} 
              alt="Highway transportation" 
              className="w-full h-full object-cover brightness-[0.25] dark:brightness-[0.2]"
            />
          </div>
          
          <div className="container relative z-10 mx-auto px-4 md:px-6 text-center">
            {settings.ctaHeading?.trim() && (
              <h2 className="text-3xl md:text-5xl font-bold font-display text-white mb-6" data-testid="text-cta-heading">{settings.ctaHeading}</h2>
            )}
            {settings.ctaSubtext?.trim() && (
              <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto" data-testid="text-cta-subtext">
                {settings.ctaSubtext}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="h-14 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-lg hover-elevate">
                <Link href="/register">Post a Job Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 px-8 rounded-xl border-white/30 text-white hover:bg-white/10 font-semibold text-lg hover-elevate bg-transparent backdrop-blur-sm">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
