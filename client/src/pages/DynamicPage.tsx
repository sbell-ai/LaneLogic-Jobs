import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useJobs } from "@/hooks/use-jobs";
import type { Page } from "@shared/schema";

const jobTypeMap: Record<string, string> = {
  "tanker-driver-jobs": "tanker",
  "flatbed-driver-jobs": "flatbed",
  "owner-operator-jobs": "owner_operator",
  "local-cdl-jobs": "local",
  "cdl-driver-jobs": "cdl",
};

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

function renderContent(html: string) {
  return { __html: html };
}

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

  const jobFilter = slug ? jobTypeMap[slug] : undefined;
  const { data: jobs } = useJobs(!!jobFilter);
  const filteredJobs = jobFilter
    ? jobs?.filter((job: any) => job.jobCategory?.toLowerCase().includes(jobFilter)).slice(0, 6)
    : undefined;

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
          <div className="max-w-3xl mx-auto">
            <h1
              className="text-3xl md:text-4xl font-bold font-display mb-8 text-foreground"
              data-testid="text-page-title"
            >
              {page.title}
            </h1>
            <div
              className="prose prose-slate dark:prose-invert max-w-none
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
                prose-img:rounded-xl prose-img:shadow-md"
              data-testid="page-content"
              dangerouslySetInnerHTML={renderContent(page.content)}
            />
          </div>
          {filteredJobs && filteredJobs.length > 0 && (
            <div className="max-w-5xl mx-auto mt-16" data-testid="section-latest-jobs">
              <h2 className="text-2xl md:text-3xl font-bold font-display mb-6 text-foreground" data-testid="text-latest-jobs-heading">
                Latest Jobs
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredJobs.map((job: any) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} data-testid={`card-job-${job.id}`}>
                    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm hover:shadow-lg hover:border-primary/40 transition-all duration-300 h-full flex flex-col group cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        {job.employerLogo ? (
                          <img src={job.employerLogo} alt={job.companyName || ""} className="w-10 h-10 rounded-xl object-contain bg-white dark:bg-slate-800 border border-border shrink-0" data-testid={`img-company-logo-${job.id}`} />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0" data-testid={`placeholder-company-logo-${job.id}`}>
                            {(job.companyName || job.title).charAt(0).toUpperCase()}
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
                        <span className="line-clamp-1">{[job.locationCity, job.locationState].filter(Boolean).join(", ") || "Remote / TBD"}</span>
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
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
