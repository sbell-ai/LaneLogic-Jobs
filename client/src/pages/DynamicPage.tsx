import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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

function renderContent(html: string) {
  return { __html: html };
}

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading, error } = useQuery<Page>({
    queryKey: ["/api/pages/slug", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/slug/${slug}`);
      if (!res.ok) throw new Error("Page not found");
      return res.json();
    },
    enabled: !!slug,
  });

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
        </div>
      </main>
      <Footer />
    </div>
  );
}
