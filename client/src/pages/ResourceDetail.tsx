import { useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Briefcase, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useJobs } from "@/hooks/use-jobs";
import type { Resource, Page } from "@shared/schema";
import { tokenize } from "@/lib/linkify";

const audienceLabel: Record<string, string> = {
  employer: "Employers",
  job_seeker: "Job Seekers",
  both: "Everyone",
};

const tierColors: Record<string, string> = {
  free: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  basic: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  premium: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
};

function LinkifiedText({ text }: { text: string }) {
  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((token, i) =>
        token.type === "url" ? (
          <a
            key={i}
            href={token.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80 break-all"
            data-testid={`link-url-${i}`}
          >
            {token.value}
          </a>
        ) : (
          <span key={i}>{token.value}</span>
        )
      )}
    </>
  );
}

type ContentSegment =
  | { type: "html"; html: string }
  | { type: "jobFeed"; category: string };

function parseContentWithBlocks(html: string): ContentSegment[] {
  const regex = /<div\s+data-job-feed=["']([^"']+)["'][^>]*>(\s*<\/div>)?/gi;
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "html", html: html.slice(lastIndex, match.index) });
    }
    segments.push({ type: "jobFeed", category: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    segments.push({ type: "html", html: html.slice(lastIndex) });
  }
  return segments;
}

const proseClasses = `prose prose-slate dark:prose-invert max-w-none
  prose-headings:font-display prose-headings:font-bold
  prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
  prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
  prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
  prose-a:text-primary prose-a:underline hover:prose-a:no-underline
  prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-4
  prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-4
  prose-li:mb-1
  prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic
  prose-strong:font-bold
  prose-img:rounded-xl prose-img:shadow-md`;

function JobCard({ job }: { job: any }) {
  return (
    <Link href={`/jobs/${job.id}`} data-testid={`card-job-${job.id}`}>
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 h-full flex flex-col group cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          {job.employerLogo ? (
            <img src={job.employerLogo} alt={job.companyName || ""} className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {(job.companyName || job.title).charAt(0).toUpperCase()}
            </div>
          )}
          {job.jobType && (
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {job.jobType}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold font-display mb-1 group-hover:text-primary transition-colors line-clamp-1">{job.title}</h3>
        {job.companyName && <p className="text-sm text-muted-foreground mb-2">{job.companyName}</p>}
        <div className="flex items-center text-muted-foreground text-xs mb-3">
          <MapPin size={14} className="mr-1 shrink-0" />
          <span className="line-clamp-1">{[job.locationCity, job.locationState].filter(Boolean).join(", ") || "Remote / TBD"}</span>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          {job.salary && <span className="text-sm font-semibold text-green-600 dark:text-green-400">{job.salary}</span>}
        </div>
      </div>
    </Link>
  );
}

function InlineJobFeed({ category, jobs }: { category: string; jobs: any[] | undefined }) {
  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (category.toLowerCase() === "all") return jobs.slice(0, 6);
    return jobs.filter((job: any) => job.category?.toLowerCase().includes(category.toLowerCase())).slice(0, 6);
  }, [jobs, category]);
  if (filtered.length === 0) return null;
  const label = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="not-prose my-8" data-testid={`section-job-feed-${category}`}>
      <h2 className="text-2xl font-bold font-display mb-6 text-foreground">Latest {label} Jobs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((job: any) => <JobCard key={job.id} job={job} />)}
      </div>
    </div>
  );
}

export default function ResourceDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: resource, isLoading, error } = useQuery<Resource>({
    queryKey: ["/api/resources", id],
    queryFn: async () => {
      const res = await fetch(`/api/resources/${id}`);
      if (!res.ok) throw new Error("Resource not found");
      return res.json();
    },
  });

  const { data: linkedPage } = useQuery<Page>({
    queryKey: ["/api/pages", resource?.pageId],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${resource!.pageId}`);
      if (!res.ok) throw new Error("Page not found");
      return res.json();
    },
    enabled: !!resource?.pageId,
  });

  const segments = useMemo(
    () => (linkedPage?.content ? parseContentWithBlocks(linkedPage.content) : []),
    [linkedPage?.content]
  );

  const hasJobFeeds = segments.some((s) => s.type === "jobFeed");
  const { data: jobs } = useJobs(hasJobFeeds);

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

  if (error || !resource) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <BookOpen className="text-muted-foreground" size={48} />
          <h1 className="text-2xl font-bold font-display" data-testid="text-resource-not-found">Resource Not Found</h1>
          <p className="text-muted-foreground">This resource may not exist or is no longer available.</p>
          <Button variant="outline" onClick={() => setLocation("/resources")} data-testid="button-back-resources">
            Back to Resources
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const introContent = resource.introText || "";
  const bodyContent = resource.bodyText || resource.content || "";
  const hasLinkedPage = !!resource.pageId && !!linkedPage;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950 py-10">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <Button
            variant="ghost"
            className="mb-6 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/resources")}
            data-testid="button-back-resources-top"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to Resources
          </Button>

          <article className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="h-56 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 flex items-center justify-center">
              <BookOpen className="text-primary/25" size={72} />
            </div>

            <div className="p-8 md:p-12">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <Badge className={`text-xs border ${tierColors[resource.requiredTier] || ''}`} data-testid="badge-resource-tier">
                  {resource.requiredTier}
                </Badge>
                <Badge variant="outline" className="text-xs" data-testid="badge-resource-audience">
                  {resource.targetAudience === "employer" ? (
                    <><Briefcase size={11} className="mr-1" />{audienceLabel[resource.targetAudience]}</>
                  ) : resource.targetAudience === "job_seeker" ? (
                    <><Users size={11} className="mr-1" />{audienceLabel[resource.targetAudience]}</>
                  ) : audienceLabel[resource.targetAudience]}
                </Badge>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold font-display mb-8 leading-tight" data-testid="text-resource-title">
                {resource.title}
              </h1>

              {hasLinkedPage ? (
                <div data-testid="resource-page-content">
                  {segments.map((segment, i) =>
                    segment.type === "html" ? (
                      <div
                        key={i}
                        className={proseClasses}
                        dangerouslySetInnerHTML={{ __html: segment.html }}
                      />
                    ) : (
                      <InlineJobFeed key={i} category={segment.category} jobs={jobs} />
                    )
                  )}
                </div>
              ) : (
                <>
                  {introContent && (
                    <div className="space-y-4 mb-8" data-testid="text-resource-intro">
                      {introContent.split("\n\n").map((para, i) => (
                        <p key={i} className="text-muted-foreground leading-relaxed text-lg">
                          {para}
                        </p>
                      ))}
                    </div>
                  )}

                  {bodyContent && (
                    <div className="space-y-4" data-testid="text-resource-body">
                      {bodyContent.split("\n\n").map((para, i) => (
                        <p key={i} className="text-muted-foreground leading-relaxed">
                          <LinkifiedText text={para} />
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="mt-10 pt-8 border-t border-border">
                <Button variant="outline" onClick={() => setLocation("/resources")} data-testid="button-back-resources-bottom">
                  <ArrowLeft size={16} className="mr-2" /> More Resources
                </Button>
              </div>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
