import { useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useJobs } from "@/hooks/use-jobs";
import { formatJobLocation } from "@/components/JobFilterSidebar";
import type { Page } from "@shared/schema";

function PageMeta({ title, description }: { title: string; description?: string | null }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    let metaEl = document.querySelector('meta[name="description"]');
    const prevDesc = metaEl?.getAttribute("content") || "";
    if (description) {
      if (!metaEl) {
        metaEl = document.createElement("meta");
        metaEl.setAttribute("name", "description");
        document.head.appendChild(metaEl);
      }
      metaEl.setAttribute("content", description);
    }
    return () => {
      document.title = prevTitle;
      if (metaEl && prevDesc) metaEl.setAttribute("content", prevDesc);
    };
  }, [title, description]);
  return null;
}

function JobCard({ job }: { job: any }) {
  return (
    <Link href={`/jobs/${job.id}`} data-testid={`card-job-${job.id}`}>
      <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 h-full flex flex-col group cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          {job.employerLogo ? (
            <img src={job.employerLogo} alt={job.companyName || ""} className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" data-testid={`img-company-logo-${job.id}`} />
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
  );
}

function InlineJobFeed({ category, jobs }: { category: string; jobs: any[] | undefined }) {
  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (category.toLowerCase() === "all") return jobs.slice(0, 6);
    return jobs
      .filter((job: any) => job.category?.toLowerCase().includes(category.toLowerCase()))
      .slice(0, 6);
  }, [jobs, category]);

  if (filtered.length === 0) return null;

  const label = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="not-prose my-8" data-testid={`section-job-feed-${category}`}>
      <h2 className="text-2xl font-bold font-display mb-6 text-foreground">
        Latest {label} Jobs
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((job: any) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
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

export default function DynamicPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams<{ slug: string }>();
  const slug = slugProp || params.slug;

  const { data: page, isLoading, error } = useQuery<Page>({
    queryKey: ["/api/pages/slug", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/slug/${slug}`);
      if (!res.ok) throw new Error("Page not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const segments = useMemo(
    () => (page?.content ? parseContentWithBlocks(page.content) : []),
    [page?.content]
  );

  const hasJobFeeds = segments.some((s) => s.type === "jobFeed");
  const { data: jobs } = useJobs(hasJobFeeds);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow bg-white dark:bg-slate-950">
          <div className="container mx-auto px-4 md:px-6 py-16">
            <div className="max-w-3xl mx-auto">
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/6" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow bg-white dark:bg-slate-950 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold font-display mb-4" data-testid="text-page-not-found">Page Not Found</h1>
            <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <PageMeta title={page.seoTitle || page.title} description={page.metaDescription} />
      <main className="flex-grow bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 md:px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h1
              className="text-3xl md:text-4xl font-bold font-display mb-8 text-foreground"
              data-testid="text-page-title"
            >
              {page.title}
            </h1>
            <div data-testid="page-content">
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
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
