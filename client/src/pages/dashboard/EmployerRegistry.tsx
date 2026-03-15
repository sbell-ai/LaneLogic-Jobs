import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, ShieldCheck, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { BackButton } from "@/components/nav/BackButton";

type VerificationBasis = {
  acceptedEvidenceCount: number;
  acceptedSourceTypes: string[];
};

type EmployerResult = {
  notionPageId: string;
  employer: string;
  domain: string;
  website: string;
  primarySource: string;
  secondarySource: string;
  status: string;
  isVerified: boolean;
  verificationBasis: VerificationBasis;
};

type LoadResult =
  | {
      ok: true;
      environment: string;
      counts: { employers: number; evidence: number; verifiedEligible: number };
      employers: EmployerResult[];
    }
  | { ok: false; error: string; message: string };

export default function EmployerRegistry() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<LoadResult>({
    queryKey: ["/api/admin/registry/employers"],
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/registry-sync/employers"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/registry/employers"] });
    },
  });

  const sorted =
    data && data.ok
      ? [...data.employers].sort(
          (a, b) => Number(a.isVerified) - Number(b.isVerified)
        )
      : [];

  return (
    <div>
      <BackButton fallback="/dashboard/admin" />
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          <h2 className="text-2xl font-bold font-display">Employer Registry</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-registry"
          >
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-registry"
          >
            {syncMutation.isPending ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <RefreshCw size={14} className="mr-1.5" />
            )}
            Sync now
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse h-20 bg-slate-100 dark:bg-slate-800 rounded-xl"
              />
            ))}
          </div>
          <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      )}

      {!isLoading && data && !data.ok && (
        <Alert variant="destructive" data-testid="alert-registry-error">
          <AlertCircle size={16} />
          <AlertDescription>
            <strong>{data.error}:</strong> {data.message}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && data && data.ok && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div
              className="bg-white dark:bg-slate-900 border border-border rounded-xl px-5 py-4"
              data-testid="stat-employers"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Employers
              </p>
              <p className="text-3xl font-bold">{data.counts.employers}</p>
            </div>
            <div
              className="bg-white dark:bg-slate-900 border border-border rounded-xl px-5 py-4"
              data-testid="stat-evidence"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Evidence
              </p>
              <p className="text-3xl font-bold">{data.counts.evidence}</p>
            </div>
            <div
              className="bg-white dark:bg-slate-900 border border-border rounded-xl px-5 py-4"
              data-testid="stat-verified-eligible"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Verified Eligible
              </p>
              <p className="text-3xl font-bold">{data.counts.verifiedEligible}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-border">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Employer
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Domain
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Verified
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Evidence
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Source Types
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">
                      Sources
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((employer) => (
                    <tr
                      key={employer.notionPageId}
                      data-testid={`row-employer-${employer.notionPageId}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-5 py-4 font-medium" data-testid={`text-employer-name-${employer.notionPageId}`}>
                        {employer.employer}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs" data-testid={`text-employer-domain-${employer.notionPageId}`}>
                        {employer.domain || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={
                            employer.status === "Verified"
                              ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300"
                              : "border-slate-300 text-slate-500"
                          }
                          data-testid={`badge-status-${employer.notionPageId}`}
                        >
                          {employer.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant="outline"
                          className={
                            employer.isVerified
                              ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300"
                              : "border-red-400 text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-300"
                          }
                          data-testid={`badge-verified-${employer.notionPageId}`}
                        >
                          {employer.isVerified ? "Verified" : "Not verified"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-center" data-testid={`text-evidence-count-${employer.notionPageId}`}>
                        {employer.verificationBasis.acceptedEvidenceCount}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {employer.verificationBasis.acceptedSourceTypes.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            employer.verificationBasis.acceptedSourceTypes.map((type) => (
                              <Badge
                                key={type}
                                variant="secondary"
                                className="text-xs px-2 py-0.5"
                                data-testid={`chip-source-type-${employer.notionPageId}-${type}`}
                              >
                                {type}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          {employer.primarySource && (
                            <a
                              href={employer.primarySource}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              data-testid={`link-primary-source-${employer.notionPageId}`}
                            >
                              <ExternalLink size={12} /> Primary
                            </a>
                          )}
                          {employer.secondarySource && (
                            <a
                              href={employer.secondarySource}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              data-testid={`link-secondary-source-${employer.notionPageId}`}
                            >
                              <ExternalLink size={12} /> Secondary
                            </a>
                          )}
                          {!employer.primarySource && !employer.secondarySource && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No employers found.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
