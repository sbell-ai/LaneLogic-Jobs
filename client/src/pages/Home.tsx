import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Search, MapPin, Briefcase, ArrowRight, ShieldCheck, Zap, Users } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useJobs } from "@/hooks/use-jobs";
import { useSiteSettings } from "@/hooks/use-settings";

export default function Home() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const settings = useSiteSettings();
  const { data: jobs, isLoading } = useJobs();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (locationQuery) params.set("loc", locationQuery);
    setLocation(`/jobs?${params.toString()}`);
  };

  const featuredJobs = jobs?.slice(0, 3) || [];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-grow">
        {/* HERO SECTION */}
        <section className={`relative overflow-hidden bg-slate-50 dark:bg-slate-950 ${
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
        }`}>
          <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.08]" 
               style={{ backgroundImage: 'radial-gradient(#1d4ed8 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
          </div>
          
          <div className="container relative z-10 mx-auto px-4 md:px-6">
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
                  <h1 className={`font-bold font-display text-foreground leading-tight tracking-tighter mb-6 text-balance ${
                    settings.heroSize === "compact" ? "text-3xl md:text-5xl" :
                    settings.heroSize === "large" ? "text-5xl md:text-7xl" :
                    "text-4xl md:text-6xl"
                  }`} data-testid="text-hero-heading">
                    {settings.heroHeading}
                  </h1>
                )}
                {settings.heroSubtext?.trim() && (
                  <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-balance" data-testid="text-hero-subtext">
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
              
              <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
                <span className="font-medium">Popular:</span>
                <Link href="/jobs?q=CDL+Driver" className="hover:text-primary transition-colors">CDL Driver</Link>
                <Link href="/jobs?q=Logistics+Manager" className="hover:text-primary transition-colors">Logistics Manager</Link>
                <Link href="/jobs?q=Dispatcher" className="hover:text-primary transition-colors">Dispatcher</Link>
                <Link href="/jobs?q=Fleet+Manager" className="hover:text-primary transition-colors">Fleet Manager</Link>
              </div>
            </div>
          </div>
        </section>

        {/* STATS/FEATURES SECTION */}
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

        {/* FEATURED JOBS SECTION */}
        <section className="py-24 bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold font-display tracking-tight text-foreground mb-4">Featured Opportunities</h2>
                <p className="text-muted-foreground text-lg">Top roles curated for you.</p>
              </div>
              <Button asChild variant="ghost" className="hidden md:flex hover-elevate">
                <Link href="/jobs" className="group">
                  View all jobs <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-2xl p-6 border border-border h-64 animate-pulse"></div>
                ))
              ) : featuredJobs.length > 0 ? (
                featuredJobs.map(job => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-xl hover:border-primary/50 transition-all duration-300 h-full flex flex-col group cursor-pointer">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-400">
                          {job.title.charAt(0)}
                        </div>
                        {job.salary && (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                            {job.salary}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold font-display mb-2 group-hover:text-primary transition-colors">{job.title}</h3>
                      <div className="flex items-center text-muted-foreground text-sm mb-4">
                        <MapPin size={16} className="mr-1" />
                        {[job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ") || "Location TBD"}
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-3 mb-6 flex-grow">
                        {job.description}
                      </p>
                      <div className="pt-4 border-t border-border mt-auto flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Posted recently</span>
                        <span className="text-primary font-medium text-sm group-hover:underline">Apply Now</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
                  <p className="text-muted-foreground">No jobs posted yet. Check back soon!</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 text-center md:hidden">
              <Button asChild variant="outline" className="w-full">
                <Link href="/jobs">View all jobs</Link>
              </Button>
            </div>
          </div>
        </section>
        
        {/* CTA SECTION */}
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
