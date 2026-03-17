import { useParams, useLocation } from "wouter";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Briefcase, Users, ShieldOff } from "lucide-react";
import { BackButton } from "@/components/nav/BackButton";
import { useQuery } from "@tanstack/react-query";
import { useAuthModal } from "@/components/AuthModal";
import { useAuth } from "@/hooks/use-auth";
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

type FetchError = { status: number; message: string };

async function fetchResource(url: string): Promise<Resource> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Error" }));
    const err: FetchError = { status: res.status, message: body.message ?? "Error" };
    throw err;
  }
  return res.json();
}

export default function ResourceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { open: openAuth } = useAuthModal();
  const { user } = useAuth();
  const isNumeric = /^\d+$/.test(slug || "");

  const { data: numericResource, isLoading: numericLoading, error: numericError } = useQuery<Resource, FetchError>({
    queryKey: ["/api/resources", slug],
    queryFn: () => fetchResource(`/api/resources/${slug}`),
    enabled: isNumeric,
    retry: false,
  });

  useEffect(() => {
    if (isNumeric && numericResource?.slug) {
      setLocation(`/resources/${numericResource.slug}`, { replace: true });
    }
  }, [isNumeric, numericResource, setLocation]);

  const { data: resource, isLoading: slugLoading, error: slugError } = useQuery<Resource, FetchError>({
    queryKey: ["/api/resources/slug", slug],
    queryFn: () => fetchResource(`/api/resources/slug/${slug}`),
    enabled: !isNumeric,
    retry: false,
  });

  const isLoading = isNumeric ? numericLoading : slugLoading;
  const error = isNumeric ? numericError : slugError;

  useEffect(() => {
    if (error && (error as FetchError).status === 401) {
      setLocation("/");
      openAuth("login");
    }
  }, [error, setLocation, openAuth]);

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

  if (isNumeric && !numericLoading && !numericError) {
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

  if (error) {
    const status = (error as FetchError).status;

    if (status === 401) {
      return (
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="flex-grow flex items-center justify-center" />
          <Footer />
        </div>
      );
    }

    if (status === 403) {
      const accountType = user?.role === "employer" ? "employer" : "job seeker";
      const oppositeType = user?.role === "employer" ? "job seeker" : "employer";
      return (
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="flex-grow flex flex-col items-center justify-center gap-4 px-4 text-center">
            <ShieldOff className="text-muted-foreground" size={48} />
            <h1 className="text-2xl font-bold font-display" data-testid="text-resource-forbidden">
              Not Available for Your Account
            </h1>
            <p className="text-muted-foreground max-w-sm">
              This resource is intended for {oppositeType} accounts. Your account is registered as an {accountType}.
            </p>
            <Button variant="outline" onClick={() => setLocation("/resources")} data-testid="button-back-resources">
              Back to Resources
            </Button>
          </div>
          <Footer />
        </div>
      );
    }

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

  if (!resource) {
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
