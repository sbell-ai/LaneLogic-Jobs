import { useParams, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Briefcase, Users } from "lucide-react";
import { BackButton } from "@/components/nav/BackButton";
import { useQuery } from "@tanstack/react-query";
import type { Resource } from "@shared/schema";
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

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950 py-10">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <BackButton fallback="/resources" />

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
