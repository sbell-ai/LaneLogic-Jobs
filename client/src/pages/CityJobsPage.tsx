import { useParams, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Briefcase, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Job } from "@shared/schema";

function toTitleCase(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CityJobsPage() {
  const { state, city } = useParams<{ state: string; city: string }>();
  const cityLabel = toTitleCase(city || "");
  const stateLabel = (state || "").toUpperCase();
  const locationLabel = `${cityLabel}, ${stateLabel}`;
  const siteUrl = "https://lanelogicjobs.com";

  const { data: allJobs = [], isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const cityJobs = allJobs.filter((j) => {
    const jCity = (j.locationCity || "").toLowerCase().replace(/\s+/g, "-");
    const jState = (j.locationState || "").toLowerCase();
    return (
      jCity === (city || "").toLowerCase() &&
      (jState === (state || "").toLowerCase() || jState.startsWith((state || "").toLowerCase()))
    );
  });

  const pageTitle = `Transportation Jobs in ${locationLabel} | LaneLogic Jobs`;
  const description = `Browse ${cityJobs.length || "the latest"} transportation and logistics jobs in ${locationLabel}. CDL drivers, dispatchers, fleet managers and more.`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": siteUrl },
      { "@type": "ListItem", "position": 2, "name": "Jobs", "item": `${siteUrl}/jobs` },
      { "@type": "ListItem", "position": 3, "name": locationLabel, "item": `${siteUrl}/jobs/${state}/${city}` },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={`${siteUrl}/jobs/${state}/${city}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-12">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Link href="/jobs" className="hover:underline">Jobs</Link>
              <span>/</span>
              <span>{locationLabel}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">
              <MapPin className="inline mr-2 text-primary" size={28} />
              Transportation Jobs in {locationLabel}
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Find CDL driver, dispatcher, logistics coordinator, and other transportation jobs in {locationLabel}.
              {cityJobs.length > 0 && ` ${cityJobs.length} job${cityJobs.length !== 1 ? "s" : ""} available now.`}
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-10 max-w-4xl">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-2xl border border-border animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && cityJobs.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
              <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
              <h2 className="font-bold font-display text-xl mb-2">No jobs in {locationLabel} right now</h2>
              <p className="text-muted-foreground mb-4">Check back soon or browse all available jobs.</p>
              <Link href="/jobs" className="text-primary underline font-semibold">Browse all jobs</Link>
            </div>
          )}

          <div className="space-y-3">
            {cityJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <div
                  data-testid={`card-city-job-${job.id}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-lg truncate">{job.title}</h2>
                      {job.companyName && <p className="text-sm text-muted-foreground truncate">{job.companyName}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {job.locationCity && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={12} /> {job.locationCity}{job.locationState ? `, ${job.locationState}` : ""}
                          </span>
                        )}
                        {job.jobType && <Badge variant="outline" className="text-xs">{job.jobType}</Badge>}
                        {job.salary && <span className="text-xs text-muted-foreground">{job.salary}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock size={11} />
                      {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : "Recently"}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
