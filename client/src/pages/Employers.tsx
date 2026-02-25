import { useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Briefcase, MapPin, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface Employer {
  id: number | null;
  companyName: string;
  companyLogo: string | null;
  claimed: boolean;
  jobCount: number;
  industries: string[];
  locations: string[];
  createdAt: string;
}

export default function Employers() {
  const [query, setQuery] = useState("");

  const { data: employers, isLoading } = useQuery<Employer[]>({
    queryKey: ["/api/employers"],
  });

  const filtered = (employers || []).filter((emp) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      emp.companyName.toLowerCase().includes(q) ||
      emp.industries.some((i) => i.toLowerCase().includes(q)) ||
      emp.locations.some((l) => l.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <main className="flex-grow bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-border py-8">
          <div className="container mx-auto px-4 md:px-6">
            <h1 className="text-3xl font-bold font-display mb-2" data-testid="text-employers-heading">Employers</h1>
            <p className="text-muted-foreground mb-6">Browse companies hiring in the transportation and logistics industry</p>
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by company name, industry, or location..."
                className="pl-10"
                data-testid="input-employer-search"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6 py-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6 animate-pulse">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-lg bg-muted" />
                    <div className="flex-1">
                      <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-4 bg-muted rounded w-full mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No employers found</h3>
              <p className="text-muted-foreground">
                {query ? "Try adjusting your search terms" : "No employers have been listed yet"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6" data-testid="text-employer-count">
                {filtered.length} compan{filtered.length !== 1 ? "ies" : "y"} hiring
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((emp, index) => (
                  <motion.div
                    key={emp.companyName}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.5) }}
                  >
                    <Link href={`/jobs?q=${encodeURIComponent(emp.companyName)}`}>
                      <div
                        className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer h-full flex flex-col"
                        data-testid={`card-employer-${emp.companyName.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className="flex items-center gap-4 mb-4">
                          {emp.companyLogo ? (
                            <img
                              src={emp.companyLogo}
                              alt={emp.companyName}
                              className="w-14 h-14 rounded-lg object-contain border border-border bg-white"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="h-7 w-7 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg truncate" data-testid={`text-employer-name-${emp.companyName.replace(/\s+/g, '-').toLowerCase()}`}>
                                {emp.companyName}
                              </h3>
                              {emp.claimed && (
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" title="Verified employer" />
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Briefcase className="h-3.5 w-3.5" />
                              <span>
                                {emp.jobCount} active job{emp.jobCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                        </div>

                        {emp.locations.length > 0 && (
                          <div className="flex items-start gap-1.5 text-sm text-muted-foreground mb-3">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{emp.locations.slice(0, 3).join(" · ")}{emp.locations.length > 3 ? ` +${emp.locations.length - 3} more` : ""}</span>
                          </div>
                        )}

                        {emp.industries.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-auto pt-3">
                            {emp.industries.slice(0, 3).map((ind) => (
                              <Badge key={ind} variant="secondary" className="text-xs">
                                {ind}
                              </Badge>
                            ))}
                            {emp.industries.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{emp.industries.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
