import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2, MapPin, Mail, Phone, User, Briefcase,
  CheckCircle2, ArrowLeft, ExternalLink, DollarSign
} from "lucide-react";
import { formatJobLocation } from "@/components/JobFilterSidebar";

interface EmployerJob {
  id: number;
  title: string;
  jobType: string | null;
  locationCity: string | null;
  locationState: string | null;
  workLocationType: string | null;
  salary: string | null;
  category: string | null;
  expiresAt: string | null;
}

interface EmployerProfile {
  id: number;
  companyName: string | null;
  companyLogo: string | null;
  companyAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  aboutCompany: string | null;
  claimed: boolean;
  industries: string[];
  locations: string[];
  jobs: EmployerJob[];
}

function fmtLoc(job: EmployerJob) {
  return formatJobLocation(job);
}

export default function EmployerProfile() {
  const params = useParams<{ id: string }>();
  const { data: employer, isLoading, isError } = useQuery<EmployerProfile>({
    queryKey: ["/api/employers", params.id],
    queryFn: () => fetch(`/api/employers/${params.id}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto px-4 md:px-6 py-12 max-w-4xl">
            <div className="animate-pulse space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8">
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-20 h-20 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-7 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                  </div>
                </div>
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !employer) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="text-center py-16">
            <Building2 className="mx-auto h-14 w-14 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Employer not found</h2>
            <p className="text-muted-foreground mb-6">This company profile doesn't exist or has been removed.</p>
            <Link href="/employers">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Employers
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const displayName = employer.companyName || "Unknown Company";

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-6">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <Link href="/employers">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors" data-testid="link-back-employers">
                <ArrowLeft className="h-4 w-4" /> All Companies
              </button>
            </Link>
            <div className="flex items-center gap-5">
              {employer.companyLogo ? (
                <img
                  src={employer.companyLogo}
                  alt={displayName}
                  className="w-20 h-20 rounded-xl object-contain border border-border bg-white p-1"
                  data-testid="img-employer-logo"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold font-display" data-testid="text-employer-name">
                    {displayName}
                  </h1>
                  {employer.claimed && (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" title="Verified employer" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                  <Briefcase className="h-4 w-4" />
                  <span data-testid="text-job-count">
                    {employer.jobs.length} open position{employer.jobs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {employer.industries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {employer.industries.map(ind => (
                      <Badge key={ind} variant="secondary" className="text-xs">{ind}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              {(employer.companyAddress || employer.contactName || employer.contactEmail || employer.contactPhone) && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 space-y-3">
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Contact Info</h2>
                  {employer.companyAddress && (
                    <div className="flex items-start gap-2 text-sm" data-testid="text-company-address">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <span>{employer.companyAddress}</span>
                    </div>
                  )}
                  {employer.contactName && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-name">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{employer.contactName}</span>
                    </div>
                  )}
                  {employer.contactEmail && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-email">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`mailto:${employer.contactEmail}`} className="hover:text-primary transition-colors">
                        {employer.contactEmail}
                      </a>
                    </div>
                  )}
                  {employer.contactPhone && (
                    <div className="flex items-center gap-2 text-sm" data-testid="text-contact-phone">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${employer.contactPhone}`} className="hover:text-primary transition-colors">
                        {employer.contactPhone}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {employer.locations.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
                  <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Locations</h2>
                  <div className="space-y-1.5">
                    {employer.locations.slice(0, 8).map(loc => (
                      <div key={loc} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {loc}
                      </div>
                    ))}
                    {employer.locations.length > 8 && (
                      <p className="text-xs text-muted-foreground pt-1">+{employer.locations.length - 8} more locations</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-6">
              {employer.aboutCompany && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6">
                  <h2 className="font-semibold text-lg mb-3" data-testid="heading-about">About {displayName}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-about-company">
                    {employer.aboutCompany}
                  </p>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6">
                <h2 className="font-semibold text-lg mb-4" data-testid="heading-open-positions">
                  Open Positions
                  {employer.jobs.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">({employer.jobs.length})</span>
                  )}
                </h2>

                {employer.jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">No open positions at this time.</p>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="list-open-positions">
                    {employer.jobs.map(job => (
                      <Link key={job.id} href={`/jobs/${job.id}`}>
                        <div
                          className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                          data-testid={`card-job-${job.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm" data-testid={`text-job-title-${job.id}`}>{job.title}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              {fmtLoc(job) && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" /> {fmtLoc(job)}
                                </span>
                              )}
                              {job.salary && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <DollarSign className="h-3 w-3" /> {job.salary}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.jobType && (
                              <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{job.jobType}</Badge>
                            )}
                            {job.category && (
                              <Badge variant="outline" className="text-xs hidden sm:inline-flex">{job.category}</Badge>
                            )}
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      </Link>
                    ))}
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
