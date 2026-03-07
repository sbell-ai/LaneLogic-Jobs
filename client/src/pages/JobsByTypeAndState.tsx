import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Briefcase, DollarSign, ExternalLink, Clock, Building2, Truck, Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fmtLoc } from "@/components/JobFilterSidebar";
import {
  JOB_CATEGORIES, findCategoryBySlug, US_STATES, STATE_ABBREV,
} from "@/config/jobCategories";
import type { JobCategory } from "@/config/jobCategories";

const MAJOR_CITIES: Record<string, string[]> = {
  texas: ["Houston", "Dallas", "San Antonio", "Austin", "Fort Worth", "El Paso"],
  california: ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "San Jose", "Fresno"],
  florida: ["Miami", "Tampa", "Orlando", "Jacksonville", "Fort Lauderdale", "St. Petersburg"],
  illinois: ["Chicago", "Aurora", "Naperville", "Joliet", "Rockford", "Springfield"],
  ohio: ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton"],
  pennsylvania: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton"],
  "new-york": ["New York City", "Buffalo", "Rochester", "Syracuse", "Albany", "Yonkers"],
  georgia: ["Atlanta", "Augusta", "Savannah", "Columbus", "Macon", "Athens"],
  michigan: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Lansing", "Ann Arbor"],
  "north-carolina": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville"],
  tennessee: ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville", "Murfreesboro"],
  indiana: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers"],
  missouri: ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit"],
  virginia: ["Virginia Beach", "Norfolk", "Chesapeake", "Richmond", "Newport News", "Alexandria"],
  washington: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent"],
  arizona: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale"],
  colorado: ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton"],
  minnesota: ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park"],
  wisconsin: ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton"],
  kentucky: ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Richmond"],
  alabama: ["Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover"],
  "south-carolina": ["Charleston", "Columbia", "Greenville", "Rock Hill", "Mount Pleasant", "Summerville"],
  louisiana: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Kenner"],
  maryland: ["Baltimore", "Columbia", "Germantown", "Silver Spring", "Waldorf", "Glen Burnie"],
  "new-jersey": ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Woodbridge"],
  arkansas: ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro", "Conway"],
  iowa: ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo"],
  kansas: ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence"],
  mississippi: ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Meridian"],
  nevada: ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City"],
  oklahoma: ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Lawton", "Edmond"],
  oregon: ["Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Bend"],
};

function matchesState(job: Job, stateSlug: string): boolean {
  const locState = job.locationState || "";
  const parts = locState.split(/[,\s]+/).map((p) => p.replace(/[^a-zA-Z]/g, "").toLowerCase()).filter(Boolean);

  const abbrev = STATE_ABBREV[stateSlug];
  if (abbrev && parts.some((p) => p === abbrev.toLowerCase())) return true;

  const fullName = (US_STATES[stateSlug] || stateSlug).toLowerCase();
  if (parts.some((p) => p === fullName)) return true;

  const fullNameParts = fullName.split(" ");
  if (fullNameParts.length > 1) {
    const joined = fullNameParts.join("");
    if (parts.some((p) => p === joined)) return true;
    if (locState.toLowerCase().includes(fullName)) return true;
  }

  return false;
}

function matchesKeywords(keywords: string[], text: string): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function tieredFilter(
  allJobs: Job[],
  category: JobCategory,
  stateSlug: string
): { jobs: Job[]; isFallback: boolean } {
  const stateJobs = allJobs.filter((job) => matchesState(job, stateSlug));

  const primaryMatches = stateJobs.filter((job) => {
    const primaryText = `${job.title || ""} ${(job as any).category || ""}`;
    return matchesKeywords(category.match, primaryText);
  });

  if (primaryMatches.length >= 3) {
    return { jobs: primaryMatches, isFallback: false };
  }

  const expandedMatches = stateJobs.filter((job) => {
    const fullText = `${job.title || ""} ${(job as any).category || ""} ${job.description || ""}`;
    return matchesKeywords(category.match, fullText);
  });

  if (expandedMatches.length >= 3) {
    return { jobs: expandedMatches, isFallback: false };
  }

  const driverFallback = stateJobs.filter((job) => {
    const fullText = `${job.title || ""} ${(job as any).category || ""} ${job.description || ""}`;
    return matchesKeywords(["driver"], fullText);
  });

  return { jobs: driverFallback, isFallback: true };
}

function PageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    (window as any).__pageTitleOverride = true;
    document.title = title;

    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content") || "";
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute("content", title);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute("content", description);

    return () => {
      (window as any).__pageTitleOverride = false;
      document.title = prevTitle;
      if (metaDesc) metaDesc.setAttribute("content", prevDesc);
      if (ogTitle) ogTitle.setAttribute("content", prevTitle);
      if (ogDesc) ogDesc.setAttribute("content", prevDesc);
    };
  }, [title, description]);
  return null;
}

interface JobsByTypeAndStateProps {
  seoSlug: string;
}

export default function JobsByTypeAndState({ seoSlug }: JobsByTypeAndStateProps) {
  const parts = seoSlug.split("-jobs-");
  const categorySlug = parts[0] || "";
  const stateSlug = parts[1] || "";

  const category = findCategoryBySlug(categorySlug);
  const stateLabel = US_STATES[stateSlug] || stateSlug;
  const stateAbbrev = STATE_ABBREV[stateSlug] || stateSlug.toUpperCase();
  const categoryLabel = category?.label || "Jobs";

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { filtered, isFallback } = useMemo(() => {
    if (!jobs || !category) return { filtered: [] as Job[], isFallback: false };
    const result = tieredFilter(jobs, category, stateSlug);
    return { filtered: result.jobs, isFallback: result.isFallback };
  }, [jobs, category, stateSlug]);

  const displayedJobs = filtered.slice(0, 12);

  const pageTitle = `${categoryLabel} in ${stateLabel} | LaneLogic Jobs`;
  const metaDescription = `Browse the latest ${categoryLabel} in ${stateLabel}. Find trucking and transportation jobs from companies hiring now.`;

  const relatedCategories = JOB_CATEGORIES.filter((c) => c.slug !== categorySlug).slice(0, 5);
  const cities = MAJOR_CITIES[stateSlug] || [];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <PageMeta title={pageTitle} description={metaDescription} />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-8">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center gap-3 mb-4">
              <Truck size={28} className="text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-jobs-type-state-heading">
                {categoryLabel} in {stateLabel}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `${filtered.length} job${filtered.length !== 1 ? "s" : ""} found`}
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-slate dark:prose-invert max-w-none mb-8 bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 md:p-8" data-testid="section-seo-content">
              <h2 className="text-xl font-bold font-display mt-0">
                {categoryLabel} in {stateLabel}
              </h2>
              <p>
                Browse the latest {categoryLabel.toLowerCase()} in {stateLabel}.
                Transportation companies across {stateLabel} are hiring qualified
                professionals for open positions now.
              </p>
              <p>
                {stateLabel} offers competitive pay and benefits for {categoryLabel.toLowerCase().replace(" jobs", "")} roles.
                Browse our current openings below and apply directly to employers hiring now.
              </p>
            </div>

            {isFallback && !isLoading && displayedJobs.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200" data-testid="text-fallback-notice">
                Showing driver jobs in {stateLabel}. More {categoryLabel.toLowerCase()} will be listed as they become available.
              </div>
            )}

            <h2 className="text-xl font-bold font-display mb-4" data-testid="text-latest-jobs-heading">
              Latest {categoryLabel} in {stateLabel}
            </h2>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border h-36 animate-pulse" />
                ))}
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
                <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
                <h2 className="text-xl font-bold font-display mb-2" data-testid="text-no-jobs-found">No jobs found</h2>
                <p className="text-muted-foreground mb-4">
                  No {categoryLabel.toLowerCase()} are currently available in {stateLabel}.
                  Check back soon or browse all available positions.
                </p>
                <Link href="/jobs">
                  <Button variant="outline" data-testid="button-browse-all-jobs">
                    Browse All Jobs
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedJobs.map((job, i) => (
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
                {filtered.length > 12 && (
                  <div className="text-center pt-4">
                    <Link href={`/jobs?q=${encodeURIComponent(categoryLabel)}&loc=${encodeURIComponent(stateAbbrev)}`}>
                      <Button variant="outline" data-testid="button-view-more-jobs">
                        View All {filtered.length} Jobs
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="mt-12 bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 md:p-8" data-testid="section-related-searches">
              <h2 className="text-xl font-bold font-display mb-5 flex items-center gap-2">
                <Search size={20} className="text-primary" />
                Related Searches
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Other Job Types in {stateLabel}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {relatedCategories.map((cat) => (
                      <Link key={cat.slug} href={`/${cat.slug}-jobs-${stateSlug}`}>
                        <span
                          className="inline-block px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-sm rounded-full hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                          data-testid={`link-related-type-${cat.slug}`}
                        >
                          {cat.label} in {stateLabel}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                {cities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {categoryLabel} in {stateLabel} Cities
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {cities.slice(0, 6).map((city) => {
                        const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
                        return (
                          <Link key={city} href={`/jobs?q=${encodeURIComponent(categoryLabel)}&loc=${encodeURIComponent(city)}`}>
                            <span
                              className="inline-block px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-sm rounded-full hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                              data-testid={`link-related-city-${citySlug}`}
                            >
                              {categoryLabel} in {city}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
