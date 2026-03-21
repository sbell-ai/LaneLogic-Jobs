import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Plus, Pencil, Trash2, Play, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, X,
} from "lucide-react";
import type { EmailCronConfig, EmailTemplate } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FilterCondition {
  field: string;
  operator: string;
  value: string;
}

interface ConfigFormData {
  name: string;
  description: string;
  templateId: number | "";
  sourceTable: string;
  triggerField: string;
  triggerOffsetDays: number;
  triggerDirection: "before" | "after";
  recipientField: string;
  recipientJoin: string;
  filterConditionsRaw: string;
  variableMappingsRaw: string;
  isActive: boolean;
  runTime: string;
}

const EMPTY_FORM: ConfigFormData = {
  name: "",
  description: "",
  templateId: "",
  sourceTable: "users",
  triggerField: "",
  triggerOffsetDays: 7,
  triggerDirection: "before",
  recipientField: "email",
  recipientJoin: "",
  filterConditionsRaw: "[]",
  variableMappingsRaw: "{}",
  isActive: true,
  runTime: "08:00",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function formatLastRun(lastRunAt: string | null | undefined): string {
  if (!lastRunAt) return "Never";
  const d = new Date(lastRunAt);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScheduledAutomations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ConfigFormData>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [testCooldown, setTestCooldown] = useState(0);
  const [testingId, setTestingId] = useState<number | null>(null);

  const { data: configs = [], isLoading } = useQuery<EmailCronConfig[]>({
    queryKey: ["/api/admin/email-cron-configs"],
  });

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/admin/email-cron-configs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-cron-configs"] });
      closeForm();
      toast({ title: "Automation created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) =>
      apiRequest("PUT", `/api/admin/email-cron-configs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-cron-configs"] });
      closeForm();
      toast({ title: "Automation updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/email-cron-configs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-cron-configs"] });
      toast({ title: "Automation deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/email-cron-configs/${id}/toggle`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/email-cron-configs"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Form helpers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: EmailCronConfig) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      description: c.description ?? "",
      templateId: c.templateId,
      sourceTable: c.sourceTable,
      triggerField: c.triggerField,
      triggerOffsetDays: c.triggerOffsetDays,
      triggerDirection: (c.triggerDirection as "before" | "after") ?? "before",
      recipientField: c.recipientField,
      recipientJoin: c.recipientJoin ?? "",
      filterConditionsRaw: JSON.stringify(c.filterConditions ?? [], null, 2),
      variableMappingsRaw: JSON.stringify(c.variableMappings ?? {}, null, 2),
      isActive: c.isActive,
      runTime: c.runTime,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function setField<K extends keyof ConfigFormData>(key: K, value: ConfigFormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (!form.templateId) return toast({ title: "Template is required", variant: "destructive" });
    if (!form.triggerField.trim()) return toast({ title: "Trigger field is required", variant: "destructive" });
    if (!form.recipientField.trim()) return toast({ title: "Recipient field is required", variant: "destructive" });
    if (!/^\d{2}:\d{2}$/.test(form.runTime)) return toast({ title: "Run time must be HH:MM (UTC)", variant: "destructive" });

    const filterConditions = parseJson<FilterCondition[]>(form.filterConditionsRaw, []);
    const variableMappings = parseJson<Record<string, string>>(form.variableMappingsRaw, {});

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      templateId: Number(form.templateId),
      sourceTable: form.sourceTable,
      triggerField: form.triggerField.trim(),
      triggerOffsetDays: Number(form.triggerOffsetDays),
      triggerDirection: form.triggerDirection,
      recipientField: form.recipientField.trim(),
      recipientJoin: form.recipientJoin.trim() || undefined,
      filterConditions,
      variableMappings,
      isActive: form.isActive,
      runTime: form.runTime,
    };

    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  async function handleTestSend(id: number) {
    if (testCooldown > 0) {
      toast({ title: `Please wait ${testCooldown}s before testing again`, variant: "destructive" });
      return;
    }
    setTestingId(id);
    try {
      const res = await apiRequest("POST", `/api/admin/email-cron-configs/${id}/test`, {});
      const data = await res.json();
      toast({
        title: "Test email sent",
        description: `Data source: ${data.source === "live_data" ? "live DB data" : "template sample data"}`,
      });
      setTestCooldown(30);
      const cd = setInterval(() => setTestCooldown(prev => {
        if (prev <= 1) { clearInterval(cd); return 0; }
        return prev - 1;
      }), 1000);
    } catch (err: any) {
      toast({ title: "Test send failed", description: err.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const scheduledTemplates = templates.filter(t => t.triggerType === "scheduled");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <Clock size={20} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display" data-testid="heading-scheduled-automations">
              Scheduled Automations
            </h2>
            <p className="text-sm text-muted-foreground">
              Database-driven cron jobs. The engine checks every 15 min and fires configs at their scheduled UTC time.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="button-add-automation" className="gap-2">
          <Plus size={16} /> New Automation
        </Button>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Paused
        </span>
        <span className="ml-auto italic">All run times are UTC</span>
      </div>

      {/* Config list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm">No scheduled automations yet.</p>
          <Button variant="outline" onClick={openCreate} className="mt-4 gap-2" data-testid="button-add-automation-empty">
            <Plus size={16} /> Add Automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(cfg => {
            const linkedTemplate = templates.find(t => t.id === cfg.templateId);
            const isExpanded = expandedId === cfg.id;
            return (
              <div
                key={cfg.id}
                data-testid={`card-automation-${cfg.id}`}
                className="border border-border rounded-xl bg-card overflow-hidden"
              >
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cfg.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    data-testid={`button-expand-${cfg.id}`}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {/* Active indicator */}
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${cfg.isActive ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"}`}
                  />

                  {/* Name + template */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-automation-name-${cfg.id}`}>
                      {cfg.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {linkedTemplate ? linkedTemplate.name : `Template #${cfg.templateId}`}
                      {" · "}
                      {cfg.sourceTable}
                      {" · "}
                      {cfg.triggerOffsetDays} days {cfg.triggerDirection}
                      {" · "}
                      Runs at {cfg.runTime} UTC
                    </p>
                  </div>

                  {/* Last run */}
                  <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
                    Last run: {formatLastRun(cfg.lastRunAt as string | null)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={cfg.isActive}
                      onCheckedChange={() => toggleMutation.mutate(cfg.id)}
                      data-testid={`switch-active-${cfg.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTestSend(cfg.id)}
                      disabled={testingId === cfg.id || testCooldown > 0}
                      title="Send test email"
                      data-testid={`button-test-${cfg.id}`}
                      className="w-8 h-8"
                    >
                      {testingId === cfg.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(cfg)}
                      data-testid={`button-edit-${cfg.id}`}
                      className="w-8 h-8"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete "${cfg.name}"?`)) deleteMutation.mutate(cfg.id);
                      }}
                      data-testid={`button-delete-${cfg.id}`}
                      className="w-8 h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border bg-slate-50 dark:bg-slate-800/30 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Source Table</p>
                      <code className="bg-muted px-1.5 py-0.5 rounded">{cfg.sourceTable}</code>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Trigger Field</p>
                      <code className="bg-muted px-1.5 py-0.5 rounded">{cfg.triggerField}</code>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Recipient Field</p>
                      <code className="bg-muted px-1.5 py-0.5 rounded">{cfg.recipientField}</code>
                    </div>
                    {cfg.recipientJoin && (
                      <div className="col-span-2 sm:col-span-3">
                        <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">JOIN</p>
                        <code className="bg-muted px-1.5 py-0.5 rounded break-all">{cfg.recipientJoin}</code>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Filter Conditions</p>
                      <pre className="bg-muted px-1.5 py-0.5 rounded text-xs overflow-auto max-h-24">
                        {JSON.stringify(cfg.filterConditions, null, 2)}
                      </pre>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Variable Mappings</p>
                      <pre className="bg-muted px-1.5 py-0.5 rounded text-xs overflow-auto max-h-24">
                        {JSON.stringify(cfg.variableMappings, null, 2)}
                      </pre>
                    </div>
                    {cfg.description && (
                      <div className="col-span-2 sm:col-span-3">
                        <p className="text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Description</p>
                        <p>{cfg.description}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Engine status card */}
      <div className="mt-6 px-4 py-3 rounded-xl border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
        <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
        <span>
          <strong>Dynamic Cron Engine is running.</strong> It ticks every 15 minutes and fires any active
          automation whose run time (UTC) matches. <code className="bg-green-100 dark:bg-green-800/40 px-1 rounded">8:00 AM Eastern = 13:00 UTC</code>
        </span>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-semibold">
                {editingId !== null ? "Edit Automation" : "New Scheduled Automation"}
              </h3>
              <button onClick={closeForm} className="text-muted-foreground hover:text-foreground" data-testid="button-close-form">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-name">Name</Label>
                <Input
                  id="sa-name"
                  data-testid="input-automation-name"
                  value={form.name}
                  onChange={e => setField("name", e.target.value)}
                  placeholder="Feature Expiring — Resume Access"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="sa-desc"
                  data-testid="input-automation-description"
                  value={form.description}
                  onChange={e => setField("description", e.target.value)}
                  rows={2}
                  placeholder="What this automation does…"
                />
              </div>

              {/* Template */}
              <div className="space-y-1.5">
                <Label>Email Template</Label>
                <Select
                  value={form.templateId === "" ? "" : String(form.templateId)}
                  onValueChange={v => setField("templateId", v === "" ? "" : Number(v))}
                >
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Select a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                        {t.triggerType && <span className="text-muted-foreground ml-1">({t.triggerType})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scheduledTemplates.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tip: Choose a template with trigger type "scheduled" for scheduled automations.
                  </p>
                )}
              </div>

              {/* Source Table + Trigger Field row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Source Table</Label>
                  <Select value={form.sourceTable} onValueChange={v => setField("sourceTable", v)}>
                    <SelectTrigger data-testid="select-source-table">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="users">users</SelectItem>
                      <SelectItem value="jobs">jobs</SelectItem>
                      <SelectItem value="applications">applications</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sa-trigger-field">Trigger Field <span className="text-xs text-muted-foreground">(column name)</span></Label>
                  <Input
                    id="sa-trigger-field"
                    data-testid="input-trigger-field"
                    value={form.triggerField}
                    onChange={e => setField("triggerField", e.target.value)}
                    placeholder="expires_at"
                  />
                </div>
              </div>

              {/* Offset + Direction row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sa-offset">Offset Days</Label>
                  <Input
                    id="sa-offset"
                    type="number"
                    min={0}
                    data-testid="input-offset-days"
                    value={form.triggerOffsetDays}
                    onChange={e => setField("triggerOffsetDays", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={form.triggerDirection} onValueChange={v => setField("triggerDirection", v as "before" | "after")}>
                    <SelectTrigger data-testid="select-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">before trigger date</SelectItem>
                      <SelectItem value="after">after trigger date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Recipient Field */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-recipient">Recipient Field</Label>
                <Input
                  id="sa-recipient"
                  data-testid="input-recipient-field"
                  value={form.recipientField}
                  onChange={e => setField("recipientField", e.target.value)}
                  placeholder="email  or  users.email"
                />
                <p className="text-xs text-muted-foreground">Column that contains the recipient's email address.</p>
              </div>

              {/* Recipient JOIN */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-join">Recipient JOIN <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="sa-join"
                  data-testid="input-recipient-join"
                  value={form.recipientJoin}
                  onChange={e => setField("recipientJoin", e.target.value)}
                  placeholder="JOIN users ON jobs.employer_id = users.id"
                />
                <p className="text-xs text-muted-foreground">
                  SQL JOIN clause to reach the email column. Only tables in the allowed list (users, jobs, applications) are permitted.
                </p>
              </div>

              {/* Run Time */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-runtime">Run Time (UTC)</Label>
                <Input
                  id="sa-runtime"
                  data-testid="input-run-time"
                  value={form.runTime}
                  onChange={e => setField("runTime", e.target.value)}
                  placeholder="08:00"
                  pattern="\d{2}:\d{2}"
                />
                <p className="text-xs text-muted-foreground">HH:MM in UTC — e.g. 8:00 AM Eastern = <code className="bg-muted px-1 rounded">13:00</code></p>
              </div>

              {/* Filter Conditions */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-filters">Filter Conditions <span className="text-muted-foreground font-normal">(JSON array)</span></Label>
                <Textarea
                  id="sa-filters"
                  data-testid="input-filter-conditions"
                  value={form.filterConditionsRaw}
                  onChange={e => setField("filterConditionsRaw", e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                  placeholder={'[\n  { "field": "is_published", "operator": "=", "value": "true" }\n]'}
                />
                <p className="text-xs text-muted-foreground">
                  Operators: = != &gt; &lt; &gt;= &lt;= IS NULL IS NOT NULL. Values are parameterized (safe).
                </p>
              </div>

              {/* Variable Mappings */}
              <div className="space-y-1.5">
                <Label htmlFor="sa-vars">Variable Mappings <span className="text-muted-foreground font-normal">(JSON object)</span></Label>
                <Textarea
                  id="sa-vars"
                  data-testid="input-variable-mappings"
                  value={form.variableMappingsRaw}
                  onChange={e => setField("variableMappingsRaw", e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                  placeholder={'{\n  "first_name": "first_name",\n  "feature_name": "literal:Resume Access",\n  "expiry_date": "expires_at"\n}'}
                />
                <p className="text-xs text-muted-foreground">
                  Maps template tokens → DB column names. Use <code className="bg-muted px-1 rounded">literal:Value</code> for static strings.
                  <br />Auto-injected: <code className="bg-muted px-1 rounded">site_name</code>, <code className="bg-muted px-1 rounded">site_url</code>, <code className="bg-muted px-1 rounded">dashboard_url</code>.
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => setField("isActive", v)}
                  data-testid="switch-form-active"
                />
                <Label className="cursor-pointer">{form.isActive ? "Active" : "Paused"}</Label>
              </div>

              {/* Validation notices */}
              {(() => {
                const filterErr = (() => { try { JSON.parse(form.filterConditionsRaw); return null; } catch { return "Filter Conditions is not valid JSON"; } })();
                const varErr = (() => { try { JSON.parse(form.variableMappingsRaw); return null; } catch { return "Variable Mappings is not valid JSON"; } })();
                return (filterErr || varErr) ? (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>{filterErr || varErr}</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2 border-t border-border sticky bottom-0 bg-white dark:bg-slate-900">
              <Button variant="outline" onClick={closeForm} data-testid="button-cancel-form">Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-automation"
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? <><Loader2 size={14} className="animate-spin mr-2" /> Saving…</>
                  : editingId !== null ? "Save Changes" : "Create Automation"
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
