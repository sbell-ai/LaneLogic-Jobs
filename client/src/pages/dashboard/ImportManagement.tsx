import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  AlertCircle, Play, Pause, RefreshCw, ChevronDown, ChevronRight,
  Search as SearchIcon, Clock, Settings, Plus, Trash2, Copy, Check,
  Download, RotateCcw, ExternalLink
} from "lucide-react";
import { formatDistanceToNow, format, differenceInSeconds } from "date-fns";

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
  sourceName: string;
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
  sourceName: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  apifyRunId: string | null;
  apifyDatasetId: string | null;
  actorInputJson: any;
  statsCreated: number;
  statsUpdated: number;
  statsSkipped: number;
  statsExpired: number;
  lastError: string | null;
  warnings: string[] | null;
  createdAt: string;
}

interface RunsResponse {
  runs: JobImportRun[];
  total: number;
  page: number;
  limit: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { cls: string; label: string }> = {
    active: { cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Active" },
    approved: { cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Approved" },
    paused: { cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Paused" },
    pending_review: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", label: "Pending Review" },
    rejected: { cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", label: "Rejected" },
    blocked: { cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Blocked" },
    queued: { cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Queued" },
    running: { cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Running" },
    succeeded: { cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Succeeded" },
    succeeded_with_warnings: { cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Warnings" },
    failed: { cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Failed" },
    complete: { cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Complete" },
    error: { cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Error" },
  };
  const v = variants[status] || { cls: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300", label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v.cls}`} data-testid={`badge-status-${status}`}>
      {v.label}
    </span>
  );
}

function duration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const endDate = end ? new Date(end) : new Date();
  const secs = differenceInSeconds(endDate, new Date(start));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      data-testid="button-copy"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Source Form ──────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: "", actorId: "", actorInputJson: "{}", pollIntervalMinutes: "360", status: "active" };

function SourceFormDialog({ source, onClose }: { source?: JobSource; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(
    source
      ? { name: source.name, actorId: source.actorId, actorInputJson: JSON.stringify(source.actorInputJson, null, 2), pollIntervalMinutes: String(source.pollIntervalMinutes), status: source.status }
      : { ...EMPTY_FORM }
  );
  const [jsonError, setJsonError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) =>
      source
        ? apiRequest("PATCH", `/api/admin/imports/sources/${source.id}`, data)
        : apiRequest("POST", "/api/admin/imports/sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/runs"] });
      toast({ title: source ? "Source updated" : "Source created" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSave = () => {
    let parsedJson: any;
    try { parsedJson = JSON.parse(form.actorInputJson); } catch { setJsonError("Invalid JSON — fix before saving."); return; }
    setJsonError("");
    mutation.mutate({ name: form.name, actorId: form.actorId, actorInputJson: parsedJson, pollIntervalMinutes: Number(form.pollIntervalMinutes), status: form.status });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{source ? "Edit Source" : "Add Source"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="src-name">Name</Label>
            <Input id="src-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Old Dominion Careers" data-testid="input-source-name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-actor-id">
              Apify Actor ID <span className="text-xs text-muted-foreground ml-1">e.g. username~actor-name</span>
            </Label>
            <Input id="src-actor-id" value={form.actorId} onChange={e => setForm(f => ({ ...f, actorId: e.target.value }))} placeholder="username~actor-name" data-testid="input-source-actor-id" />
            <p className="text-xs text-muted-foreground">
              Find your actor ID in the{" "}
              <a href="https://console.apify.com/actors" target="_blank" rel="noopener noreferrer" className="underline text-primary inline-flex items-center gap-0.5">
                Apify console <ExternalLink className="h-3 w-3" />
              </a>{" "}
              → Actors → [your actor] → API tab
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-interval">Poll Interval (minutes)</Label>
            <Input id="src-interval" type="number" value={form.pollIntervalMinutes} onChange={e => setForm(f => ({ ...f, pollIntervalMinutes: e.target.value }))} data-testid="input-source-interval" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-status">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger id="src-status" data-testid="select-source-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="src-json">
              Actor Input JSON <span className="text-xs text-muted-foreground ml-1">(controls which companies are scraped)</span>
            </Label>
            <Textarea
              id="src-json"
              value={form.actorInputJson}
              onChange={e => { setForm(f => ({ ...f, actorInputJson: e.target.value })); setJsonError(""); }}
              onBlur={() => { try { JSON.parse(form.actorInputJson); setJsonError(""); } catch { setJsonError("Invalid JSON"); } }}
              rows={8}
              className={`font-mono text-xs ${jsonError ? "border-destructive" : ""}`}
              data-testid="textarea-source-json"
            />
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending} data-testid="button-save-source">
            {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Live Run Status Panel ────────────────────────────────────────────────────

function LiveRunsPanel({ newRunId, onNewRunConsumed }: { newRunId: number | null; onNewRunConsumed: () => void }) {
  const { data: initialData } = useQuery<RunsResponse>({
    queryKey: ["/api/admin/imports/runs", { limit: 10 }],
    queryFn: () => fetch("/api/admin/imports/runs?limit=10").then(r => r.json()),
  });
  const [runs, setRuns] = useState<JobImportRun[]>([]);
  const [expandedError, setExpandedError] = useState<number | null>(null);
  const intervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    if (initialData?.runs) setRuns(initialData.runs);
  }, [initialData]);

  const pollRun = useCallback((id: number) => {
    if (intervalsRef.current.has(id)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/imports/runs/${id}`);
        const run: JobImportRun = await res.json();
        setRuns(prev => prev.map(r => r.id === id ? { ...r, ...run } : r));
        if (run.status !== "queued" && run.status !== "running") {
          clearInterval(intervalsRef.current.get(id));
          intervalsRef.current.delete(id);
        }
      } catch { /* ignore */ }
    }, 10000);
    intervalsRef.current.set(id, interval);
  }, []);

  useEffect(() => {
    runs.forEach(r => {
      if (r.status === "queued" || r.status === "running") pollRun(r.id);
    });
  }, [runs, pollRun]);

  useEffect(() => {
    if (newRunId === null) return;
    setRuns(prev => {
      if (prev.some(r => r.id === newRunId)) return prev;
      const placeholder: JobImportRun = {
        id: newRunId, sourceId: 0, sourceName: "—", status: "queued",
        startedAt: null, finishedAt: null, apifyRunId: null, apifyDatasetId: null,
        actorInputJson: null, statsCreated: 0, statsUpdated: 0, statsSkipped: 0, statsExpired: 0,
        lastError: null, warnings: null, createdAt: new Date().toISOString(),
      };
      return [placeholder, ...prev].slice(0, 10);
    });
    pollRun(newRunId);
    onNewRunConsumed();
  }, [newRunId, pollRun, onNewRunConsumed]);

  useEffect(() => {
    return () => { intervalsRef.current.forEach(i => clearInterval(i)); };
  }, []);

  if (!runs.length) return null;

  return (
    <div className="mt-6" data-testid="section-live-runs">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Current & Recent Runs</h3>
      <div className="border rounded-lg overflow-hidden divide-y">
        {runs.map(run => {
          const isLive = run.status === "queued" || run.status === "running";
          return (
            <div key={run.id} className={`p-3 ${isLive ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`} data-testid={`row-live-run-${run.id}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={run.status} />
                  {isLive && <RefreshCw className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                  <span className="text-sm font-medium truncate" data-testid={`text-live-run-source-${run.id}`}>{run.sourceName}</span>
                  <span className="text-xs text-muted-foreground">#{run.id}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span data-testid={`text-live-run-start-${run.id}`}>{run.startedAt ? format(new Date(run.startedAt), "h:mm a") : "Starting…"}</span>
                  <span>{isLive ? "Running…" : duration(run.startedAt, run.finishedAt)}</span>
                  {!isLive && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600" data-testid={`text-live-created-${run.id}`}>+{run.statsCreated}</span>
                      <span className="text-blue-600">~{run.statsUpdated}</span>
                      <span className="text-slate-500">-{run.statsSkipped}</span>
                      <span className="text-red-600">×{run.statsExpired}</span>
                    </div>
                  )}
                  {run.status === "failed" && run.lastError && (
                    <button
                      className="underline text-destructive text-xs"
                      onClick={() => setExpandedError(expandedError === run.id ? null : run.id)}
                      data-testid={`button-view-error-${run.id}`}
                    >
                      View Error
                    </button>
                  )}
                </div>
              </div>
              {expandedError === run.id && run.lastError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200 font-mono break-all" data-testid={`text-live-error-${run.id}`}>
                  {run.lastError}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sources Section ──────────────────────────────────────────────────────────

function SourcesSection() {
  const { data: sources, isLoading } = useQuery<JobSource[]>({ queryKey: ["/api/admin/imports/sources"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editSource, setEditSource] = useState<JobSource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobSource | null>(null);
  const [newRunId, setNewRunId] = useState<number | null>(null);

  const patchMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PATCH", `/api/admin/imports/sources/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/sources"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/imports/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/sources"] });
      toast({ title: "Source deleted" });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: "Cannot delete", description: err.message, variant: "destructive" }),
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/imports/sources/${id}/run`),
    onSuccess: (data: any) => {
      toast({ title: "Import run started" });
      if (data?.runId) setNewRunId(data.runId);
    },
    onError: (err: any) => toast({ title: "Run failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-muted-foreground" data-testid="text-sources-loading">Loading sources…</div>;

  return (
    <div className="space-y-4" data-testid="section-sources">
      {(showForm || editSource) && (
        <SourceFormDialog
          source={editSource || undefined}
          onClose={() => { setShowForm(false); setEditSource(null); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will not delete jobs already imported from this source. The source configuration and run history will be removed. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete-source"
            >
              Delete Source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">Import Sources</h3>
        <Button size="sm" onClick={() => setShowForm(true)} data-testid="button-add-source">
          <Plus className="h-4 w-4 mr-1" /> Add Source
        </Button>
      </div>

      {!sources?.length ? (
        <div className="text-muted-foreground text-center py-8 border rounded-lg border-dashed" data-testid="text-sources-empty">
          No import sources configured. Add one to start importing jobs.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <div key={source.id} className="border rounded-lg p-4 space-y-3" data-testid={`card-source-${source.id}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold" data-testid={`text-source-name-${source.id}`}>{source.name}</h4>
                  <StatusBadge status={source.status} />
                  {source.consecutiveFailures > 0 && (
                    <span className="text-xs text-red-600 font-medium" data-testid={`badge-failures-${source.id}`}>
                      {source.consecutiveFailures} failures
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditSource(source)} data-testid={`button-configure-source-${source.id}`}>
                    <Settings className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  {source.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => patchMutation.mutate({ id: source.id, status: "paused" })} data-testid={`button-pause-source-${source.id}`}>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => patchMutation.mutate({ id: source.id, status: "active" })} data-testid={`button-activate-source-${source.id}`}>
                      <Play className="h-4 w-4 mr-1" /> Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => runMutation.mutate(source.id)}
                    disabled={runMutation.isPending}
                    data-testid={`button-run-source-${source.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${runMutation.isPending ? "animate-spin" : ""}`} /> Run Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(source)}
                    data-testid={`button-delete-source-${source.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1" data-testid={`text-actor-id-${source.id}`}>
                Actor: {source.actorId}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
                <div data-testid={`text-poll-interval-${source.id}`}>
                  <Clock className="h-3 w-3 inline mr-1" />Poll every {source.pollIntervalMinutes}m
                </div>
                <div data-testid={`text-last-run-${source.id}`}>
                  Last run: {source.lastRunAt ? formatDistanceToNow(new Date(source.lastRunAt), { addSuffix: true }) : "Never"}
                </div>
                <div data-testid={`text-last-success-${source.id}`}>
                  Last success: {source.lastSuccessfulRunAt ? formatDistanceToNow(new Date(source.lastSuccessfulRunAt), { addSuffix: true }) : "Never"}
                </div>
                {source.lastRunAt && source.pollIntervalMinutes && (
                  <div>
                    Next: {format(new Date(new Date(source.lastRunAt).getTime() + source.pollIntervalMinutes * 60000), "MMM d h:mm a")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LiveRunsPanel newRunId={newRunId} onNewRunConsumed={() => setNewRunId(null)} />
    </div>
  );
}

// ── Targets Section ──────────────────────────────────────────────────────────

function TargetsSection({ onSwitchToTargets }: { onSwitchToTargets?: () => void }) {
  const { data: targets, isLoading, refetch } = useQuery<ImportTarget[]>({ queryKey: ["/api/admin/imports/targets"] });
  const { data: pendingCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/imports/targets/pending-count"],
    queryFn: () => fetch("/api/admin/imports/targets/pending-count").then(r => r.json()),
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editDomainTarget, setEditDomainTarget] = useState<ImportTarget | null>(null);
  const [editDomain, setEditDomain] = useState("");
  const [rejectConfirm, setRejectConfirm] = useState<{ ids: number[]; label: string } | null>(null);
  const [blockConfirm, setBlockConfirm] = useState<ImportTarget | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [k: string]: any }) =>
      apiRequest("PATCH", `/api/admin/imports/targets/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/targets/pending-count"] });
      setEditDomainTarget(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) =>
      apiRequest("POST", "/api/admin/imports/targets/bulk", { ids, status }),
    onSuccess: (_data: any, vars: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/targets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/imports/targets/pending-count"] });
      setSelected(new Set());
      setRejectConfirm(null);
      toast({ title: `${vars.ids.length} targets updated` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const tabCounts = {
    all: targets?.length || 0,
    pending_review: targets?.filter(t => t.status === "pending_review").length || 0,
    active: targets?.filter(t => t.status === "active").length || 0,
    rejected: targets?.filter(t => t.status === "rejected").length || 0,
    blocked: targets?.filter(t => t.status === "blocked").length || 0,
  };

  const filtered = (targets || []).filter(t => {
    const matchesSearch = !search || t.companyName.toLowerCase().includes(search.toLowerCase()) || t.sourceDomain.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingInFiltered = filtered.filter(t => t.status === "pending_review").map(t => t.id);
  const allPendingSelected = pendingInFiltered.length > 0 && pendingInFiltered.every(id => selected.has(id));

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectedArr = Array.from(selected);

  if (isLoading) return <div className="text-muted-foreground" data-testid="text-targets-loading">Loading targets…</div>;

  const TABS: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending_review", label: "Pending Review" },
    { key: "active", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "blocked", label: "Blocked" },
  ];

  return (
    <div className="space-y-4" data-testid="section-targets">
      {/* Bulk reject confirmation */}
      <AlertDialog open={!!rejectConfirm} onOpenChange={() => setRejectConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejectConfirm?.ids.length} {rejectConfirm?.ids.length === 1 ? "company" : "companies"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Jobs from {rejectConfirm?.label} will be excluded from future imports. Existing imported jobs are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rejectConfirm && bulkMutation.mutate({ ids: rejectConfirm.ids, status: "rejected" })} data-testid="button-confirm-reject">
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block confirmation */}
      <AlertDialog open={!!blockConfirm} onOpenChange={() => setBlockConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block "{blockConfirm?.companyName}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-destructive font-medium">
              All existing jobs from this company will be immediately removed and no future jobs will be imported. This cannot be undone easily.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => blockConfirm && updateMutation.mutate({ id: blockConfirm.id, status: "blocked", expireAll: true })}
              data-testid="button-confirm-block"
            >
              Block & Remove All Jobs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit domain dialog */}
      {editDomainTarget && (
        <Dialog open onOpenChange={() => setEditDomainTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Edit Employer Domain</DialogTitle></DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Employer Website Domain</Label>
              <Input value={editDomain} onChange={e => setEditDomain(e.target.value)} placeholder="e.g. example.com" data-testid="input-employer-domain" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDomainTarget(null)}>Cancel</Button>
              <Button onClick={() => updateMutation.mutate({ id: editDomainTarget.id, employerWebsiteDomain: editDomain })} data-testid="button-save-domain">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-0.5 border-b">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${statusFilter === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            data-testid={`tab-target-${tab.key}`}
          >
            {tab.label}
            {tabCounts[tab.key as keyof typeof tabCounts] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab.key === "pending_review" && tabCounts.pending_review > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" : "bg-muted text-muted-foreground"}`}>
                {tabCounts[tab.key as keyof typeof tabCounts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search companies or domains…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-targets" />
      </div>

      {/* Bulk action bar */}
      {selectedArr.length > 0 && (
        <div className="flex items-center gap-3 p-2 bg-muted/60 rounded-lg border text-sm" data-testid="bulk-action-bar">
          <span className="font-medium">{selectedArr.length} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate({ ids: selectedArr, status: "active" })} disabled={bulkMutation.isPending} data-testid="button-bulk-approve">
            Approve All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejectConfirm({ ids: selectedArr, label: selectedArr.length === 1 ? "this company" : `these ${selectedArr.length} companies` })}
            disabled={bulkMutation.isPending}
            data-testid="button-bulk-reject"
          >
            Reject All
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} data-testid="button-clear-selection">
            Clear Selection
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-muted-foreground text-center py-8 border rounded-lg border-dashed" data-testid="text-targets-empty">
          No discovered companies {statusFilter !== "all" ? `with status "${statusFilter}"` : ""}.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={allPendingSelected}
                    onCheckedChange={checked => {
                      if (checked) setSelected(prev => new Set([...prev, ...pendingInFiltered]));
                      else setSelected(prev => { const n = new Set(prev); pendingInFiltered.forEach(id => n.delete(id)); return n; });
                    }}
                    data-testid="checkbox-select-all"
                  />
                </th>
                <th className="p-3 font-medium">Company</th>
                <th className="p-3 font-medium">Domain</th>
                <th className="p-3 font-medium">Source</th>
                <th className="p-3 font-medium">First Seen</th>
                <th className="p-3 font-medium">Last Seen</th>
                <th className="p-3 font-medium text-right">Jobs</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(target => (
                <tr key={target.id} className="text-sm" data-testid={`row-target-${target.id}`}>
                  <td className="p-3">
                    {target.status === "pending_review" && (
                      <Checkbox
                        checked={selected.has(target.id)}
                        onCheckedChange={() => toggleSelect(target.id)}
                        data-testid={`checkbox-target-${target.id}`}
                      />
                    )}
                  </td>
                  <td className="p-3 font-medium">
                    <div className="flex items-center gap-2">
                      {target.status === "pending_review" && (
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      )}
                      <span data-testid={`text-target-company-${target.id}`}>{target.companyName}</span>
                    </div>
                    {target.employerWebsiteDomain && (
                      <div className="text-xs text-muted-foreground mt-0.5">{target.employerWebsiteDomain}</div>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs" data-testid={`text-target-domain-${target.id}`}>{target.sourceDomain}</td>
                  <td className="p-3 text-muted-foreground text-xs">{target.sourceName || "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {target.firstSeenAt ? format(new Date(target.firstSeenAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(target.lastSeenAt), { addSuffix: true })}
                  </td>
                  <td className="p-3 text-right font-mono text-xs" data-testid={`text-target-jobs-${target.id}`}>{target.jobCount}</td>
                  <td className="p-3"><StatusBadge status={target.status} /></td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {/* Approve */}
                      {["pending_review", "rejected"].includes(target.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                          onClick={() => updateMutation.mutate({ id: target.id, status: "active" })}
                          title="Import jobs from this company"
                          disabled={updateMutation.isPending}
                          data-testid={`button-approve-target-${target.id}`}
                        >
                          Approve
                        </Button>
                      )}
                      {/* Reject */}
                      {["pending_review", "active"].includes(target.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectConfirm({ ids: [target.id], label: `"${target.companyName}"` })}
                          title="Skip future imports. Existing jobs stay live until they expire naturally."
                          disabled={updateMutation.isPending}
                          data-testid={`button-reject-target-${target.id}`}
                        >
                          Reject
                        </Button>
                      )}
                      {/* Block */}
                      {target.status !== "blocked" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setBlockConfirm(target)}
                          title="Remove all existing jobs immediately and never import again."
                          disabled={updateMutation.isPending}
                          data-testid={`button-block-target-${target.id}`}
                        >
                          Block
                        </Button>
                      )}
                      {/* Unblock */}
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
                      {/* Edit domain */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditDomainTarget(target); setEditDomain(target.employerWebsiteDomain || ""); }}
                        title="Edit employer website domain"
                        data-testid={`button-edit-domain-${target.id}`}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status legend */}
      <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
        <p><span className="font-medium text-green-700 dark:text-green-400">Approve</span> — Import jobs from this company going forward.</p>
        <p><span className="font-medium">Reject</span> — Skip future imports. Existing jobs stay live until they expire naturally.</p>
        <p><span className="font-medium text-destructive">Block</span> — Remove all existing jobs immediately and never import again.</p>
      </div>
    </div>
  );
}

// ── Run History Section ──────────────────────────────────────────────────────

function RunsSection() {
  const { data: sources } = useQuery<JobSource[]>({ queryKey: ["/api/admin/imports/sources"] });
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (sourceFilter) params.set("sourceId", sourceFilter);
  if (dateRange) params.set("date_range", dateRange);
  params.set("page", String(page));
  params.set("limit", String(LIMIT));

  const { data, isLoading } = useQuery<RunsResponse>({
    queryKey: ["/api/admin/imports/runs", statusFilter, sourceFilter, dateRange, page],
    queryFn: () => fetch(`/api/admin/imports/runs?${params}`).then(r => r.json()),
  });

  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [runJobs, setRunJobs] = useState<Record<number, any[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const runMutation = useMutation({
    mutationFn: (sourceId: number) => apiRequest("POST", `/api/admin/imports/sources/${sourceId}/run`),
    onSuccess: () => toast({ title: "Re-run started" }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleExpand = async (run: JobImportRun) => {
    const newId = expandedRun === run.id ? null : run.id;
    setExpandedRun(newId);
    if (newId && !runJobs[run.id] && !loadingJobs.has(run.id)) {
      setLoadingJobs(prev => new Set([...prev, run.id]));
      try {
        const res = await fetch(`/api/admin/imports/runs/${run.id}/jobs`);
        const jobs = await res.json();
        setRunJobs(prev => ({ ...prev, [run.id]: jobs }));
      } catch { /* ignore */ }
      finally { setLoadingJobs(prev => { const n = new Set(prev); n.delete(run.id); return n; }); }
    }
  };

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  const exportUrl = () => {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (sourceFilter) p.set("sourceId", sourceFilter);
    if (dateRange) p.set("date_range", dateRange);
    return `/api/admin/imports/runs/export?${p}`;
  };

  return (
    <div className="space-y-4" data-testid="section-runs">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter || "all"} onValueChange={v => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="select-run-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="succeeded">Complete</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter || "all"} onValueChange={v => { setSourceFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-run-source"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateRange || "all"} onValueChange={v => { setDateRange(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" data-testid="select-run-date"><SelectValue placeholder="All time" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <a href={exportUrl()} download="import-runs.csv">
          <Button size="sm" variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </a>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground" data-testid="text-runs-loading">Loading runs…</div>
      ) : !data?.runs?.length ? (
        <div className="text-muted-foreground text-center py-8 border rounded-lg border-dashed" data-testid="text-runs-empty">No import runs found.</div>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-3 font-medium">Source</th>
                  <th className="p-3 font-medium">Started</th>
                  <th className="p-3 font-medium">Finished</th>
                  <th className="p-3 font-medium">Duration</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Created</th>
                  <th className="p-3 font-medium text-right">Updated</th>
                  <th className="p-3 font-medium text-right">Skipped</th>
                  <th className="p-3 font-medium text-right">Expired</th>
                  <th className="p-3 font-medium">Apify Run ID</th>
                  <th className="p-3 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.runs.map(run => (
                  <>
                    <tr
                      key={run.id}
                      className={`text-sm cursor-pointer hover:bg-muted/30 transition-colors ${run.status === "failed" || run.status === "error" ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}
                      onClick={() => handleExpand(run)}
                      data-testid={`row-run-${run.id}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-run-source-${run.id}`}>{run.sourceName}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {run.startedAt ? format(new Date(run.startedAt), "MMM d, h:mm a") : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {run.finishedAt ? format(new Date(run.finishedAt), "MMM d, h:mm a") : run.status === "running" ? "Running…" : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{duration(run.startedAt, run.finishedAt)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={run.status} />
                          {(run.status === "running" || run.status === "queued") && <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />}
                        </div>
                      </td>
                      <td className="p-3 text-right text-green-600 font-mono text-xs" data-testid={`text-run-created-${run.id}`}>+{run.statsCreated}</td>
                      <td className="p-3 text-right text-blue-600 font-mono text-xs">~{run.statsUpdated}</td>
                      <td className="p-3 text-right text-muted-foreground font-mono text-xs">-{run.statsSkipped}</td>
                      <td className="p-3 text-right text-red-600 font-mono text-xs">×{run.statsExpired}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground" data-testid={`text-run-apify-${run.id}`}>
                        {run.apifyRunId ? (
                          <div className="flex items-center gap-1">
                            <span>{run.apifyRunId.slice(0, 8)}…</span>
                            <CopyButton text={run.apifyRunId} />
                          </div>
                        ) : "—"}
                      </td>
                      <td className="p-3">
                        {expandedRun === run.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </td>
                    </tr>

                    {expandedRun === run.id && (
                      <tr key={`${run.id}-detail`}>
                        <td colSpan={11} className="p-0">
                          <div className="p-4 bg-muted/10 border-t space-y-3 text-sm" data-testid={`detail-run-${run.id}`}>
                            {/* Error */}
                            {run.lastError && (
                              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded" data-testid={`text-run-error-${run.id}`}>
                                <p className="font-semibold text-red-700 dark:text-red-400 mb-1">Error</p>
                                <p className="text-xs text-red-800 dark:text-red-200 font-mono break-all">{run.lastError}</p>
                              </div>
                            )}

                            {/* Warnings */}
                            {run.warnings && run.warnings.length > 0 && (
                              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded" data-testid={`text-run-warnings-${run.id}`}>
                                <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Warnings ({run.warnings.length})</p>
                                <ul className="text-xs text-amber-800 dark:text-amber-200 list-disc list-inside max-h-28 overflow-y-auto space-y-0.5">
                                  {run.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                                  {run.warnings.length > 20 && <li>…and {run.warnings.length - 20} more</li>}
                                </ul>
                              </div>
                            )}

                            {/* Actor input snapshot */}
                            {run.actorInputJson && (
                              <div>
                                <p className="font-semibold text-muted-foreground text-xs mb-1">Actor Input (snapshot)</p>
                                <pre className="text-xs bg-muted/40 rounded p-2 overflow-x-auto max-h-32 font-mono">{JSON.stringify(run.actorInputJson, null, 2)}</pre>
                              </div>
                            )}

                            {/* Jobs approximate */}
                            {run.finishedAt && (
                              <div>
                                <p className="font-semibold text-muted-foreground text-xs mb-1">Jobs imported during this run <span className="font-normal">(approximate — based on source + time window)</span></p>
                                {loadingJobs.has(run.id) ? (
                                  <p className="text-xs text-muted-foreground">Loading…</p>
                                ) : runJobs[run.id]?.length ? (
                                  <div className="border rounded overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/50">
                                        <tr>
                                          <th className="p-2 text-left font-medium">Title</th>
                                          <th className="p-2 text-left font-medium">Company</th>
                                          <th className="p-2 text-left font-medium">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {runJobs[run.id].map((j: any) => (
                                          <tr key={j.id}>
                                            <td className="p-2">{j.title}</td>
                                            <td className="p-2 text-muted-foreground">{j.companyName || "—"}</td>
                                            <td className="p-2"><StatusBadge status={j.status || "active"} /></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">No jobs traced to this run.</p>
                                )}
                              </div>
                            )}

                            {/* Re-run button */}
                            {(run.status === "failed" || run.status === "error") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={e => { e.stopPropagation(); runMutation.mutate(run.sourceId); }}
                                disabled={runMutation.isPending}
                                data-testid={`button-rerun-${run.id}`}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Re-run Source
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.total} total runs</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">← Prev</Button>
              <span>Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-next-page">Next →</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export default function ImportManagement() {
  const [tab, setTab] = useState<"sources" | "targets" | "runs">("sources");

  const { data: pendingCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/imports/targets/pending-count"],
    queryFn: () => fetch("/api/admin/imports/targets/pending-count").then(r => r.json()),
    refetchInterval: 60000,
  });
  const pendingCount = pendingCountData?.count || 0;

  return (
    <div className="space-y-6" data-testid="section-import-management">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-imports-heading">Job Imports</h2>
        <p className="text-muted-foreground mt-1">Manage automated job import from Apify scrapers. Actors are registered by ID only — build them in the Apify console.</p>
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && tab !== "targets" && (
        <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="banner-pending-targets">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{pendingCount}</strong> {pendingCount === 1 ? "company" : "companies"} pending review — requires your attention before jobs will be imported.
            </span>
          </div>
          <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900" onClick={() => setTab("targets")} data-testid="button-review-targets">
            Review Now
          </Button>
        </div>
      )}

      {/* Tab nav */}
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
          {pendingCount > 0 && (
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              {pendingCount}
            </span>
          )}
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
      {tab === "targets" && <TargetsSection onSwitchToTargets={() => setTab("targets")} />}
      {tab === "runs" && <RunsSection />}
    </div>
  );
}
