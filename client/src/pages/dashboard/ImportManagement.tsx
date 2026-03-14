import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle, Play, Pause, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  Search as SearchIcon, Clock, CheckCircle2, XCircle, AlertTriangle, Eye
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface JobSource {
  id: number;
  name: string;
  type: string;
  actorId: string;
  actorInputJson: any;
  status: string;
  pollIntervalMinutes: number;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

interface ImportTarget {
  id: number;
  sourceId: number;
  sourceDomain: string;
  companyName: string;
  employerWebsiteDomain: string | null;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  jobCount: number;
}

interface JobImportRun {
  id: number;
  sourceId: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  apifyRunId: string | null;
  apifyDatasetId: string | null;
  statsCreated: number;
  statsUpdated: number;
  statsSkipped: number;
  statsExpired: number;
  lastError: string | null;
  warnings: string[] | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "default", label: "Active" },
    paused: { variant: "secondary", label: "Paused" },
    pending_review: { variant: "outline", label: "Pending Review" },
    blocked: { variant: "destructive", label: "Blocked" },
    running: { variant: "default", label: "Running" },
    succeeded: { variant: "default", label: "Succeeded" },
    succeeded_with_warnings: { variant: "outline", label: "Warnings" },
    failed: { variant: "destructive", label: "Failed" },
  };
  const v = variants[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={v.variant} data-testid={`badge-status-${status}`}>{v.label}</Badge>;
}

function SourcesSection() {
  const { data: sources, isLoading } = useQuery<JobSource[]>({ queryKey: ["/api/admin/imports/sources"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PATCH", `/api/admin/imports/sources/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/sources"] });
      toast({ title: "Source updated" });
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ id, importTargetId }: { id: number; importTargetId?: number }) =>
      apiRequest("POST", `/api/admin/imports/sources/${id}/run`, { importTargetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/runs"] });
      toast({ title: "Import run started" });
    },
  });

  if (isLoading) return <div className="text-muted-foreground" data-testid="text-sources-loading">Loading sources...</div>;
  if (!sources?.length) return <div className="text-muted-foreground" data-testid="text-sources-empty">No job sources configured.</div>;

  return (
    <div className="space-y-4" data-testid="section-sources">
      {sources.map(source => (
        <div key={source.id} className="border rounded-lg p-4 space-y-3" data-testid={`card-source-${source.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg" data-testid={`text-source-name-${source.id}`}>{source.name}</h3>
              <StatusBadge status={source.status} />
              {source.consecutiveFailures > 0 && (
                <Badge variant="destructive" data-testid={`badge-failures-${source.id}`}>
                  {source.consecutiveFailures} failures
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {source.status === "paused" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMutation.mutate({ id: source.id, status: "active" })}
                  disabled={updateMutation.isPending}
                  data-testid={`button-activate-source-${source.id}`}
                >
                  <Play className="h-4 w-4 mr-1" /> Activate
                </Button>
              )}
              {source.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMutation.mutate({ id: source.id, status: "paused" })}
                  disabled={updateMutation.isPending}
                  data-testid={`button-pause-source-${source.id}`}
                >
                  <Pause className="h-4 w-4 mr-1" /> Pause
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => runMutation.mutate({ id: source.id })}
                disabled={runMutation.isPending}
                data-testid={`button-run-source-${source.id}`}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Run Now
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div data-testid={`text-poll-interval-${source.id}`}>
              <Clock className="h-3 w-3 inline mr-1" />
              Poll every {source.pollIntervalMinutes} min
            </div>
            <div data-testid={`text-last-run-${source.id}`}>
              Last run: {source.lastRunAt ? formatDistanceToNow(new Date(source.lastRunAt), { addSuffix: true }) : "Never"}
            </div>
            <div data-testid={`text-last-success-${source.id}`}>
              Last success: {source.lastSuccessfulRunAt ? formatDistanceToNow(new Date(source.lastSuccessfulRunAt), { addSuffix: true }) : "Never"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TargetsSection() {
  const { data: targets, isLoading } = useQuery<ImportTarget[]>({ queryKey: ["/api/admin/imports/targets"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const updateMutation = useMutation({
    mutationFn: ({ id, status, expireAll }: { id: number; status: string; expireAll?: boolean }) =>
      apiRequest("PATCH", `/api/admin/imports/targets/${id}`, { status, expireAll }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/targets"] });
      toast({ title: "Target updated" });
    },
  });

  const pendingCount = targets?.filter(t => t.status === "pending_review").length || 0;

  const filtered = targets?.filter(t => {
    const matchesSearch = !search ||
      t.companyName.toLowerCase().includes(search.toLowerCase()) ||
      t.sourceDomain.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  if (isLoading) return <div className="text-muted-foreground" data-testid="text-targets-loading">Loading targets...</div>;

  return (
    <div className="space-y-4" data-testid="section-targets">
      {pendingCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2" data-testid="banner-pending-review">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            {pendingCount} new {pendingCount === 1 ? "domain requires" : "domains require"} activation before import.
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies or domains..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-targets"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground text-center py-8" data-testid="text-targets-empty">
          No discovered companies {statusFilter !== "all" ? `with status "${statusFilter}"` : ""} found.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="text-left text-sm">
                <th className="p-3 font-medium">Company</th>
                <th className="p-3 font-medium">Domain</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Jobs</th>
                <th className="p-3 font-medium">Last Seen</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(target => (
                <tr key={target.id} className="text-sm" data-testid={`row-target-${target.id}`}>
                  <td className="p-3 font-medium" data-testid={`text-target-company-${target.id}`}>{target.companyName}</td>
                  <td className="p-3 text-muted-foreground" data-testid={`text-target-domain-${target.id}`}>{target.sourceDomain}</td>
                  <td className="p-3"><StatusBadge status={target.status} /></td>
                  <td className="p-3 text-right" data-testid={`text-target-jobs-${target.id}`}>{target.jobCount}</td>
                  <td className="p-3 text-muted-foreground">
                    {formatDistanceToNow(new Date(target.lastSeenAt), { addSuffix: true })}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {target.status === "pending_review" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: target.id, status: "active" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-activate-target-${target.id}`}
                        >
                          Activate
                        </Button>
                      )}
                      {target.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: target.id, status: "paused" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-pause-target-${target.id}`}
                        >
                          Pause
                        </Button>
                      )}
                      {target.status === "paused" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: target.id, status: "active" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-resume-target-${target.id}`}
                        >
                          Resume
                        </Button>
                      )}
                      {target.status !== "blocked" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateMutation.mutate({ id: target.id, status: "blocked", expireAll: true })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-block-target-${target.id}`}
                        >
                          Block
                        </Button>
                      )}
                      {target.status === "blocked" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: target.id, status: "pending_review" })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-unblock-target-${target.id}`}
                        >
                          Unblock
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunsSection() {
  const { data: runs, isLoading } = useQuery<JobImportRun[]>({ queryKey: ["/api/admin/imports/runs"] });
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [detailRun, setDetailRun] = useState<JobImportRun | null>(null);

  if (isLoading) return <div className="text-muted-foreground" data-testid="text-runs-loading">Loading import runs...</div>;
  if (!runs?.length) return <div className="text-muted-foreground" data-testid="text-runs-empty">No import runs yet.</div>;

  return (
    <div className="space-y-3" data-testid="section-runs">
      {runs.map(run => (
        <div key={run.id} className="border rounded-lg overflow-hidden" data-testid={`card-run-${run.id}`}>
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
            onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
            data-testid={`button-expand-run-${run.id}`}
          >
            <div className="flex items-center gap-3">
              {expandedRun === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-medium">Run #{run.id}</span>
              <StatusBadge status={run.status} />
              {run.status === "running" && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {run.status !== "running" && (
                <div className="flex items-center gap-3">
                  <span className="text-green-600" data-testid={`text-run-created-${run.id}`}>+{run.statsCreated}</span>
                  <span className="text-blue-600" data-testid={`text-run-updated-${run.id}`}>~{run.statsUpdated}</span>
                  <span className="text-gray-500" data-testid={`text-run-skipped-${run.id}`}>-{run.statsSkipped}</span>
                  <span className="text-red-600" data-testid={`text-run-expired-${run.id}`}>x{run.statsExpired}</span>
                </div>
              )}
              <span>{format(new Date(run.startedAt), "MMM d, h:mm a")}</span>
            </div>
          </div>

          {expandedRun === run.id && (
            <div className="border-t p-3 bg-muted/10 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Started:</span>{" "}
                  {format(new Date(run.startedAt), "PPpp")}
                </div>
                {run.finishedAt && (
                  <div>
                    <span className="text-muted-foreground">Finished:</span>{" "}
                    {format(new Date(run.finishedAt), "PPpp")}
                  </div>
                )}
                {run.apifyRunId && (
                  <div data-testid={`text-run-apify-id-${run.id}`}>
                    <span className="text-muted-foreground">Apify Run:</span> {run.apifyRunId}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-green-50 dark:bg-green-950 rounded p-2">
                  <div className="text-green-600 font-bold">{run.statsCreated}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 rounded p-2">
                  <div className="text-blue-600 font-bold">{run.statsUpdated}</div>
                  <div className="text-xs text-muted-foreground">Updated</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                  <div className="text-gray-600 font-bold">{run.statsSkipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 rounded p-2">
                  <div className="text-red-600 font-bold">{run.statsExpired}</div>
                  <div className="text-xs text-muted-foreground">Expired</div>
                </div>
              </div>
              {run.lastError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2" data-testid={`text-run-error-${run.id}`}>
                  <span className="text-red-600 font-medium">Error:</span>{" "}
                  <span className="text-red-800 dark:text-red-200">{run.lastError}</span>
                </div>
              )}
              {run.warnings && run.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-2 space-y-1" data-testid={`text-run-warnings-${run.id}`}>
                  <span className="text-amber-600 font-medium">Warnings ({run.warnings.length}):</span>
                  <ul className="text-xs text-amber-800 dark:text-amber-200 list-disc list-inside max-h-32 overflow-y-auto">
                    {run.warnings.slice(0, 20).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {run.warnings.length > 20 && <li>...and {run.warnings.length - 20} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ImportManagement() {
  const [tab, setTab] = useState<"sources" | "targets" | "runs">("sources");

  return (
    <div className="space-y-6" data-testid="section-import-management">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-imports-heading">Job Imports</h2>
        <p className="text-muted-foreground mt-1">Manage automated job import from Apify/Workday scrapers.</p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "sources" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("sources")}
          data-testid="tab-sources"
        >
          Sources
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "targets" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("targets")}
          data-testid="tab-targets"
        >
          Discovered Companies
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "runs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("runs")}
          data-testid="tab-runs"
        >
          Run History
        </button>
      </div>

      {tab === "sources" && <SourcesSection />}
      {tab === "targets" && <TargetsSection />}
      {tab === "runs" && <RunsSection />}
    </div>
  );
}
