import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { FileText, Briefcase, CreditCard, Plus, CheckCircle2, Clock, XCircle, AlertCircle, Eye, EyeOff, User, Gauge, ShoppingCart, CalendarClock, Zap, ChevronDown, ChevronRight, MessageSquare, PauseCircle, StickyNote, Save, Check, Bell, Trash2, Search, Bookmark, BookmarkCheck } from "lucide-react";
import type { Application, Resume, Job, JobAlertSubscription, SavedJob } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaxonomy } from "@/hooks/use-taxonomy";

const SEEKER_STATUS_MAP: Record<string, { label: string; icon: typeof Clock; color: string; group: string }> = {
  new:         { label: "Application Received", icon: Clock,        color: "bg-yellow-100 text-yellow-700 border-yellow-200", group: "active" },
  pending:     { label: "Application Received", icon: Clock,        color: "bg-yellow-100 text-yellow-700 border-yellow-200", group: "active" },
  shortlisted: { label: "Under Review",         icon: Eye,          color: "bg-blue-100 text-blue-700 border-blue-200",       group: "active" },
  reviewed:    { label: "Under Review",         icon: Eye,          color: "bg-blue-100 text-blue-700 border-blue-200",       group: "active" },
  hired:       { label: "Offer Extended",       icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200",   group: "offer"  },
  accepted:    { label: "Offer Extended",       icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200",   group: "offer"  },
  on_hold:     { label: "On Hold",              icon: PauseCircle,  color: "bg-orange-100 text-orange-700 border-orange-200", group: "on_hold"},
  not_a_fit:   { label: "Position Filled",      icon: XCircle,      color: "bg-slate-100 text-slate-500 border-slate-200",   group: "closed" },
  rejected:    { label: "Position Filled",      icon: XCircle,      color: "bg-slate-100 text-slate-500 border-slate-200",   group: "closed" },
};

const SEEKER_GROUPS = [
  { key: "active",  label: "Active Applications", icon: Briefcase,    headerColor: "text-foreground",   defaultOpen: true },
  { key: "offer",   label: "Offer Extended",       icon: CheckCircle2, headerColor: "text-green-600",    defaultOpen: true },
  { key: "on_hold", label: "On Hold",              icon: PauseCircle,  headerColor: "text-orange-600",   defaultOpen: true },
  { key: "closed",  label: "Position Filled",      icon: XCircle,      headerColor: "text-slate-500",    defaultOpen: false },
];

function SeekerApplicationCard({
  app, meta, Icon, job, isMessaging, canMessage, onMessage, onNotesSaved,
}: {
  app: Application;
  meta: { label: string; color: string };
  Icon: typeof Clock;
  job: Job | undefined;
  isMessaging: boolean;
  canMessage: boolean;
  onMessage: () => void;
  onNotesSaved: (notes: string) => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(app.seekerNotes ?? "");
  const saved = app.seekerNotes ?? "";
  const isDirty = draft !== saved;

  const noteMutation = useMutation({
    mutationFn: (notes: string) =>
      apiRequest("PUT", `/api/applications/${app.id}`, { seekerNotes: notes }).then((r) => r.json()),
    onSuccess: (updated: any) => {
      onNotesSaved(updated.seekerNotes ?? "");
      toast({ title: "Note saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save note.", variant: "destructive" }),
  });

  return (
    <div data-testid={`card-application-${app.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" data-testid={`text-job-title-${app.id}`}>
            {job ? job.title : `Job #${app.jobId}`}
          </p>
          {job?.companyName && (
            <p className="text-sm text-muted-foreground truncate">{job.companyName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Applied {app.createdAt ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }) : "recently"}
          </p>
          {app.viewedAt ? (
            <p className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1" data-testid={`text-viewed-${app.id}`}>
              <Eye size={11} /> Viewed by employer
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60 mt-0.5" data-testid={`text-not-viewed-${app.id}`}>Not yet viewed</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`border ${meta.color} flex items-center gap-1.5 whitespace-nowrap`}>
            <Icon size={12} /> {meta.label}
          </Badge>
          {canMessage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid={`button-message-employer-${app.id}`}
              disabled={isMessaging}
              onClick={onMessage}
            >
              <MessageSquare size={13} />
              {isMessaging ? "Opening…" : "Message"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1.5 mb-2">
          <StickyNote size={13} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">My Notes</span>
          {isDirty && <span className="text-xs text-orange-500 ml-1">● unsaved</span>}
        </div>
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Jot down anything useful — interview prep, contacts, follow-up reminders…"
            rows={2}
            data-testid={`textarea-seeker-notes-${app.id}`}
            className="flex-1 text-sm rounded-lg border border-border bg-slate-50 dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
          />
          <Button
            size="sm"
            variant={isDirty ? "default" : "ghost"}
            disabled={!isDirty || noteMutation.isPending}
            onClick={() => noteMutation.mutate(draft)}
            data-testid={`button-save-seeker-notes-${app.id}`}
            className="self-end gap-1.5 shrink-0"
          >
            {noteMutation.isPending ? <Check size={14} /> : <Save size={14} />}
            {noteMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {job && (
        <div className="mt-3 pt-3 border-t border-border">
          <Link href={`/jobs/${job.id}`} className="text-xs text-primary hover:underline">
            View job listing →
          </Link>
        </div>
      )}
    </div>
  );
}

function ApplicationsTab({ userId }: { userId: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: applications, isLoading: appsLoading } = useQuery<Application[]>({
    queryKey: ["/api/seeker/applications"],
  });
  const { data: allJobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SEEKER_GROUPS.map((g) => [g.key, g.defaultOpen]))
  );
  const [messagingAppId, setMessagingAppId] = useState<number | null>(null);

  const myApps = (applications || []).filter((a) => a.jobSeekerId === userId);
  const jobMap = new Map((allJobs || []).map((j) => [j.id, j]));

  const messageMutation = useMutation({
    mutationFn: (app: Application) =>
      apiRequest("POST", "/api/conversations", {
        seekerId: userId,
        employerId: jobMap.get(app.jobId)?.employerId,
        jobId: app.jobId,
      }).then((r) => r.json()),
    onSuccess: (conv: any) => {
      setMessagingAppId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setLocation(`/dashboard/messages?conv=${conv.id}`);
    },
    onError: () => {
      setMessagingAppId(null);
      toast({ title: "Error", description: "Could not open conversation.", variant: "destructive" });
    },
  });

  if (appsLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  if (myApps.length === 0) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold font-display">My Applications</h2>
          <Button asChild variant="outline" size="sm"><Link href="/jobs">Browse Jobs</Link></Button>
        </div>
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display text-lg mb-2">No applications yet</h3>
          <p className="text-muted-foreground mb-4">Start applying to transportation jobs that match your skills.</p>
          <Button asChild><Link href="/jobs">Find Jobs</Link></Button>
        </div>
      </div>
    );
  }

  const grouped: Record<string, Application[]> = Object.fromEntries(SEEKER_GROUPS.map((g) => [g.key, []]));
  myApps.forEach((app) => {
    const meta = SEEKER_STATUS_MAP[app.status] ?? SEEKER_STATUS_MAP.pending;
    grouped[meta.group].push(app);
  });

  const renderCard = (app: Application & { seekerNotes?: string | null }) => {
    const meta = SEEKER_STATUS_MAP[app.status] ?? SEEKER_STATUS_MAP.pending;
    const Icon = meta.icon;
    const job = jobMap.get(app.jobId);
    const isMessaging = messagingAppId === app.id;
    const canMessage = !!job?.employerId;

    return (
      <SeekerApplicationCard
        key={app.id}
        app={app}
        meta={meta}
        Icon={Icon}
        job={job}
        isMessaging={isMessaging}
        canMessage={canMessage}
        onMessage={() => { setMessagingAppId(app.id); messageMutation.mutate(app); }}
        onNotesSaved={(notes) => {
          queryClient.setQueryData<Application[]>(["/api/seeker/applications"], (prev) =>
            (prev || []).map((a) => (a.id === app.id ? { ...a, seekerNotes: notes } : a))
          );
        }}
      />
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">My Applications ({myApps.length})</h2>
        <Button asChild variant="outline" size="sm"><Link href="/jobs">Browse More Jobs</Link></Button>
      </div>
      <div className="space-y-6">
        {SEEKER_GROUPS.map((group) => {
          const cards = grouped[group.key] || [];
          if (cards.length === 0 && group.key !== "active") return null;
          const isOpen = openGroups[group.key];
          const GroupIcon = group.icon;
          return (
            <div key={group.key} data-testid={`group-${group.key}`}>
              <button
                className="w-full flex items-center gap-2 mb-3"
                onClick={() => setOpenGroups((p) => ({ ...p, [group.key]: !p[group.key] }))}
                data-testid={`group-toggle-${group.key}`}
              >
                <GroupIcon size={16} className={group.headerColor} />
                <span className={`font-bold font-display ${group.headerColor}`}>{group.label}</span>
                <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal">{cards.length}</Badge>
                <div className="flex-1 h-px bg-border mx-2" />
                {isOpen ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronRight size={15} className="text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="space-y-4">
                  {cards.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No applications here yet.</p>
                  ) : (
                    cards.map(renderCard)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type EntitlementInfo = {
  type: "Limit" | "Flag";
  value: number;
  isUnlimited: boolean;
  enabled: boolean;
};

function ResumeTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resumeText, setResumeText] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: resumes, isLoading } = useQuery<Resume[]>({
    queryKey: ["/api/resumes", userId],
    queryFn: async () => {
      const res = await fetch(`/api/resumes/${userId}`);
      if (!res.ok) throw new Error("Failed to load resumes");
      return res.json();
    },
  });

  const { data: entitlementData } = useQuery<{ entitlements: Record<string, EntitlementInfo> }>({
    queryKey: ["/api/user/entitlements"],
  });

  const resumeEnt = entitlementData?.entitlements?.["resumes_per_month"];
  const resumeLimit = resumeEnt?.isUnlimited ? Infinity : (resumeEnt?.value ?? 0);
  const resumeCount = resumes?.length ?? 0;
  const atLimit = !resumeEnt?.isUnlimited && resumeCount >= resumeLimit;

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/resumes", { jobSeekerId: userId, content: resumeText, isUpload: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/entitlements"] });
      setResumeText("");
      setShowForm(false);
      toast({ title: "Resume saved!", description: "Your resume has been added to your profile." });
    },
    onError: (err: any) => {
      const msg = err?.message || "Could not save resume.";
      toast({ title: "Error", description: msg.includes("limit") ? msg : "Could not save resume.", variant: "destructive" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">My Resumes</h2>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-resume-usage">
            {!resumeEnt
              ? "Not included in your plan"
              : resumeEnt.isUnlimited
                ? `${resumeCount} resume${resumeCount !== 1 ? "s" : ""} (unlimited)`
                : `${resumeCount} of ${resumeLimit} resume${resumeLimit !== 1 ? "s" : ""} used`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {atLimit && (
            <Button asChild variant="outline" data-testid="button-upgrade-resume-limit">
              <Link href="/pricing?tab=job-seeker">Upgrade Plan</Link>
            </Button>
          )}
          <Button onClick={() => !atLimit && setShowForm(!showForm)} data-testid="button-add-resume" disabled={atLimit || !resumeEnt}>
            <Plus size={16} className="mr-2" /> Add Resume
          </Button>
        </div>
      </div>

      {atLimit && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 flex items-center gap-3" data-testid="banner-resume-limit">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Resume limit reached</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You've used all {resumeLimit} resume{resumeLimit !== 1 ? "s" : ""} on your plan. Upgrade to add more.
            </p>
          </div>
        </div>
      )}

      {showForm && !atLimit && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6 mb-6">
          <h3 className="font-bold font-display mb-3">Create Text Resume</h3>
          <Textarea
            data-testid="textarea-resume-content"
            placeholder="Paste or write your resume here..."
            className="min-h-[200px] mb-4"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!resumeText.trim() || createMutation.isPending}
              data-testid="button-save-resume"
            >
              {createMutation.isPending ? "Saving..." : "Save Resume"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {resumes && resumes.length > 0 ? (
        <div className="space-y-4">
          {resumes.map((resume) => (
            <div key={resume.id} data-testid={`card-resume-${resume.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">Resume #{resume.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resume.createdAt
                        ? formatDistanceToNow(new Date(resume.createdAt), { addSuffix: true })
                        : "Recently created"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{resume.content}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <FileText className="mx-auto mb-4 text-muted-foreground" size={40} />
            <h3 className="font-bold font-display text-lg mb-2">No resumes yet</h3>
            <p className="text-muted-foreground mb-4">
              {atLimit || !resumeEnt ? "Upgrade your plan to add resumes." : "Add your resume so employers can find you."}
            </p>
            {atLimit || !resumeEnt ? (
              <Button asChild variant="outline">
                <Link href="/pricing?tab=job-seeker">Upgrade Plan</Link>
              </Button>
            ) : (
              <Button onClick={() => setShowForm(true)} data-testid="button-create-resume-empty">Create Resume</Button>
            )}
          </div>
        )
      )}
    </div>
  );
}

type EntitlementData = {
  entitlementKey: string;
  type: "Limit" | "Flag";
  value: number;
  isUnlimited: boolean;
  enabled: boolean;
};

function formatEntitlementDisplay(ent: EntitlementData): string {
  if (ent.type === "Flag") return ent.enabled ? "Enabled" : "Disabled";
  if (ent.isUnlimited) return "Unlimited";
  return String(ent.value);
}

function formatEntitlementLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type QuotaData = {
  freeQuota: number;
  freeUsed: number;
  freeRemaining: number;
  isUnlimited: boolean;
  windowResetDate: string;
  creditPacks: { id: number; remaining: number; expiresAt: string; grantedAt: string }[];
  totalCredits: number;
};

function QuotaTab() {
  const { data, isLoading } = useQuery<{ quotas: Record<string, QuotaData> }>({
    queryKey: ["/api/user/quota-status"],
  });

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  const quotas = data?.quotas ?? {};
  const appQuota = quotas["applications_per_month"];

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">Usage & Quota</h2>

      {appQuota && (
        <Card className="p-6 mb-6" data-testid="card-quota-applications">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="font-bold font-display text-lg">Applications</h3>
              <p className="text-sm text-muted-foreground">Monthly free quota</p>
            </div>
          </div>

          {appQuota.isUnlimited ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold" data-testid="text-quota-unlimited">
              <Zap size={16} />
              <span>Unlimited applications</span>
            </div>
          ) : (
            <>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {appQuota.freeUsed} / {appQuota.freeQuota} used this period
                </span>
                <span className="font-semibold text-primary" data-testid="text-quota-remaining">
                  {appQuota.freeRemaining} remaining
                </span>
              </div>
              <Progress
                value={appQuota.freeQuota > 0 ? (appQuota.freeUsed / appQuota.freeQuota) * 100 : 0}
                className="h-2.5 mb-3"
                data-testid="progress-quota"
              />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-quota-reset">
                <CalendarClock size={13} />
                <span>Resets {format(new Date(appQuota.windowResetDate), "MMM d, yyyy")}</span>
              </div>
            </>
          )}
        </Card>
      )}

      {appQuota && appQuota.creditPacks.length > 0 && (
        <Card className="p-6 mb-6" data-testid="card-credit-packs">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h3 className="font-bold font-display text-lg">Credit Packs</h3>
              <p className="text-sm text-muted-foreground">
                {appQuota.totalCredits} total credits remaining
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {appQuota.creditPacks.map((pack) => (
              <div key={pack.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 border border-border" data-testid={`credit-pack-${pack.id}`}>
                <div>
                  <p className="text-sm font-medium">{pack.remaining} credits remaining</p>
                  <p className="text-xs text-muted-foreground">
                    Purchased {format(new Date(pack.grantedAt), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Credits are consumed automatically when your free monthly quota is exhausted. Oldest packs are used first.
          </p>
        </Card>
      )}

      {appQuota && !appQuota.isUnlimited && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" data-testid="card-topup-cta">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="text-primary" size={24} />
            <h3 className="font-bold font-display text-lg">Need more applications?</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Purchase a top-up credit pack to apply beyond your free monthly quota. Credits expire 12 months from purchase date.
          </p>
          <Button asChild size="sm" data-testid="button-buy-topup">
            <Link href="/pricing">View Top-Up Packs</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}

function MembershipTab({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fulfilledRef = useRef(false);
  const { data: entitlementData } = useQuery<{ entitlements: Record<string, EntitlementData> }>({
    queryKey: ["/api/user/entitlements"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const isAddon = params.get("addon") === "true";
    if (sessionId && isAddon && !fulfilledRef.current) {
      fulfilledRef.current = true;
      apiRequest("POST", "/api/payments/fulfill-addon", { sessionId })
        .then((r) => r.json())
        .then((data) => {
          toast({ title: "Add-on activated!", description: data.message });
          queryClient.invalidateQueries({ queryKey: ["/api/user/entitlements"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user/quota-status"] });
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch(() => {
          toast({ title: "Fulfillment issue", description: "Your payment was received. Add-on may take a moment to activate.", variant: "destructive" });
        });
    }
  }, []);

  const entitlements = entitlementData?.entitlements ?? {};
  const entKeys = Object.keys(entitlements);

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">Membership</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <CreditCard size={28} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Current Plan</p>
            <h3 className="text-3xl font-bold font-display capitalize text-primary" data-testid="text-membership-tier">{user.membershipTier}</h3>
          </div>
        </div>

        {entKeys.length > 0 && (
          <div className="mb-8">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Your Entitlements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entKeys.map((key) => {
                const ent = entitlements[key];
                return (
                  <div key={key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 border border-border" data-testid={`entitlement-${key}`}>
                    <span className="text-sm font-medium">{formatEntitlementLabel(key)}</span>
                    <Badge variant={ent.isUnlimited || ent.enabled ? "default" : "secondary"}>
                      {formatEntitlementDisplay(ent)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button asChild className="hover-elevate shadow-lg shadow-primary/20">
          <Link href="/pricing">Upgrade Plan</Link>
        </Button>
      </div>
    </div>
  );
}

function SeekerProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  const [showProfile, setShowProfile] = useState(user?.showProfile ?? true);
  const [showName, setShowName] = useState(user?.showName ?? true);
  const [showCurrentEmployer, setShowCurrentEmployer] = useState(user?.showCurrentEmployer ?? true);

  const saveMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; profileImage: string; showProfile: boolean; showName: boolean; showCurrentEmployer: boolean }) =>
      apiRequest("PATCH", "/api/profile", data).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.setQueryData(["/api/me"], data);
      toast({ title: "Profile updated!" });
    },
    onError: () => toast({ title: "Error", description: "Could not save profile.", variant: "destructive" }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">My Profile</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold mb-1 block">First Name</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" data-testid="input-first-name" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1 block">Last Name</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" data-testid="input-last-name" />
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1 block">Profile Picture</Label>
          <p className="text-xs text-muted-foreground mb-2">Upload a profile photo or paste an image URL.</p>
          <ImageUpload
            value={profileImage}
            onChange={setProfileImage}
            placeholder="Upload or paste image URL"
            previewHeight="h-32"
            data-testid="image-profile-pic"
          />
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center gap-2 mb-4">
            {showProfile ? <Eye size={18} className="text-primary" /> : <EyeOff size={18} className="text-muted-foreground" />}
            <h3 className="text-lg font-bold font-display">Privacy Settings</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Choose what employers and other users can see on your public profile.</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border">
              <div>
                <Label className="text-sm font-semibold">Show Profile</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Allow your profile to be visible to employers</p>
              </div>
              <Switch
                checked={showProfile}
                onCheckedChange={setShowProfile}
                data-testid="switch-show-profile"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border">
              <div>
                <Label className="text-sm font-semibold">Show Name</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Display your full name on your profile</p>
              </div>
              <Switch
                checked={showName}
                onCheckedChange={setShowName}
                data-testid="switch-show-name"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border">
              <div>
                <Label className="text-sm font-semibold">Show Current Employer</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Display your current company on your profile</p>
              </div>
              <Switch
                checked={showCurrentEmployer}
                onCheckedChange={setShowCurrentEmployer}
                data-testid="switch-show-current-employer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-profile">
                <Eye size={16} className="mr-2" /> View Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Public Profile Preview</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground mb-4">This is how employers and other users see your profile.</p>
              {!showProfile ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-border">
                  <EyeOff className="mx-auto mb-3 text-muted-foreground" size={32} />
                  <p className="font-semibold text-sm">Profile Hidden</p>
                  <p className="text-xs text-muted-foreground mt-1">Your profile is not visible to others.</p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-16 w-16 border-2 border-border">
                      <AvatarImage src={profileImage} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {showName && firstName ? firstName[0]?.toUpperCase() : <User size={24} />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      {showName ? (
                        <h3 className="font-bold font-display text-lg" data-testid="text-preview-name">
                          {firstName || lastName ? `${firstName} ${lastName}`.trim() : "No name set"}
                        </h3>
                      ) : (
                        <h3 className="font-bold font-display text-lg text-muted-foreground italic" data-testid="text-preview-name">
                          Anonymous Job Seeker
                        </h3>
                      )}
                    </div>
                  </div>
                  {showCurrentEmployer ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-preview-employer">
                      <Briefcase size={14} />
                      <span>{user?.companyName || "No current employer listed"}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground italic" data-testid="text-preview-employer">
                      <Briefcase size={14} />
                      <span>Current employer hidden</span>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => saveMutation.mutate({ firstName, lastName, profileImage, showProfile, showName, showCurrentEmployer })}
            disabled={saveMutation.isPending}
            data-testid="button-save-profile"
          >
            {saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function SavedJobsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: savedJobs = [], isLoading } = useQuery<SavedJob[]>({ queryKey: ["/api/saved-jobs"] });
  const { data: allJobs = [] } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest("DELETE", `/api/saved-jobs/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-jobs"] });
      toast({ title: "Removed from saved jobs" });
    },
  });

  const jobMap = new Map(allJobs.map((j) => [j.id, j]));

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6 flex items-center gap-2"><Bookmark size={20} /> Saved Jobs</h2>
      {savedJobs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <Bookmark className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display text-lg mb-2">No saved jobs yet</h3>
          <p className="text-muted-foreground mb-4">Save jobs while browsing to revisit them later.</p>
          <Link href="/jobs"><a className="text-primary underline font-semibold">Browse jobs</a></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {savedJobs.map((saved) => {
            const job = jobMap.get(saved.jobId);
            return (
              <div key={saved.id} data-testid={`card-saved-job-${saved.jobId}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {job ? (
                    <>
                      <Link href={`/jobs/${job.id}`}>
                        <a className="font-semibold hover:underline truncate block" data-testid={`link-saved-job-title-${job.id}`}>{job.title}</a>
                      </Link>
                      {job.companyName && <p className="text-sm text-muted-foreground truncate">{job.companyName}</p>}
                      {job.locationCity && <p className="text-xs text-muted-foreground">{job.locationCity}{job.locationState ? `, ${job.locationState}` : ""}</p>}
                    </>
                  ) : (
                    <p className="font-semibold">Job #{saved.jobId}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Saved {saved.createdAt ? formatDistanceToNow(new Date(saved.createdAt), { addSuffix: true }) : "recently"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {job && (
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-saved-job-${job.id}`}>View</Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => unsaveMutation.mutate(saved.jobId)}
                    disabled={unsaveMutation.isPending}
                    data-testid={`button-unsave-job-${saved.jobId}`}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JobAlertsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getAllCategories } = useTaxonomy();
  const allCategories = getAllCategories();
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("any");
  const [locationState, setLocationState] = useState("any");
  const [jobType, setJobType] = useState("any");

  const { data: alerts = [], isLoading } = useQuery<JobAlertSubscription[]>({
    queryKey: ["/api/alerts"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/alerts", {
      name: name.trim() || null,
      keyword: keyword.trim() || null,
      category: category === "any" ? null : category,
      locationState: locationState === "any" ? null : locationState,
      jobType: jobType === "any" ? null : jobType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setName("");
      setKeyword("");
      setCategory("any");
      setLocationState("any");
      setJobType("any");
      toast({ title: "Alert created", description: "You'll receive an email when a matching job is posted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not create alert", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Alert removed" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/alerts/${id}`, { isActive }).then((r) => r.json()),
    onSuccess: (updated: JobAlertSubscription) => {
      queryClient.setQueryData<JobAlertSubscription[]>(["/api/alerts"], (prev) =>
        (prev || []).map((a) => (a.id === updated.id ? updated : a))
      );
      toast({ title: updated.isActive ? "Alert resumed" : "Alert paused" });
    },
    onError: () => toast({ title: "Error", description: "Could not update alert.", variant: "destructive" }),
  });

  function alertLabel(alert: JobAlertSubscription) {
    if (alert.name) return alert.name;
    const parts: string[] = [];
    if (alert.keyword) parts.push(`"${alert.keyword}"`);
    if (alert.category) parts.push(alert.category);
    if (alert.locationState) parts.push(alert.locationState);
    if (alert.jobType) parts.push(alert.jobType);
    if (alert.workLocationType) parts.push(alert.workLocationType);
    return parts.length > 0 ? parts.join(" · ") : "All jobs";
  }

  const handleCreate = () => {
    if (!keyword.trim() && category === "any" && locationState === "any" && jobType === "any") {
      toast({ title: "Add at least one filter", description: "Choose a keyword, category, location, or job type.", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
          <Bell size={22} className="text-primary" /> Job Alerts
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Get notified by email whenever a new job matches your criteria. Up to 5 active alerts.
        </p>
      </div>

      {/* Create Alert Form */}
      {alerts.length < 5 && (
        <Card className="p-5 mb-6 border border-border">
          <h3 className="font-semibold mb-4">Create a New Alert</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs mb-1 block">Alert Name (optional)</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. CDL Jobs in Texas"
                data-testid="input-alert-name"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Keyword (optional)</Label>
              <Input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="e.g. Class A CDL, dispatcher"
                data-testid="input-alert-keyword"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Category (optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-alert-category">
                  <SelectValue placeholder="Any category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any category</SelectItem>
                  {allCategories.map((cat: string) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">State (optional)</Label>
              <Select value={locationState} onValueChange={setLocationState}>
                <SelectTrigger data-testid="select-alert-state">
                  <SelectValue placeholder="Any state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any state</SelectItem>
                  {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Job Type (optional)</Label>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger data-testid="select-alert-jobtype">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="temporary">Temporary</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            data-testid="button-create-alert"
          >
            <Bell size={15} className="mr-2" />
            {createMutation.isPending ? "Creating…" : "Create Alert"}
          </Button>
        </Card>
      )}

      {/* Existing Alerts */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No alerts yet</p>
          <p className="text-sm mt-1">Create your first alert above to get notified of new jobs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.length >= 5 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">You've reached the maximum of 5 alerts. Delete one to add a new one.</p>
          )}
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`flex items-center justify-between gap-3 p-4 rounded-xl border bg-white dark:bg-slate-900 transition-opacity ${alert.isActive ? "border-border" : "border-border opacity-60"}`}
              data-testid={`card-alert-${alert.id}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Bell size={16} className={alert.isActive ? "text-primary shrink-0" : "text-muted-foreground shrink-0"} />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate" data-testid={`text-alert-label-${alert.id}`}>{alertLabel(alert)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {!alert.isActive && (
                      <span className="text-xs text-muted-foreground italic">Paused</span>
                    )}
                    {alert.lastNotifiedAt && (
                      <p className="text-xs text-muted-foreground">Last sent: {format(new Date(alert.lastNotifiedAt), "MMM d, yyyy")}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ id: alert.id, isActive: !alert.isActive })}
                  data-testid={`button-toggle-alert-${alert.id}`}
                  title={alert.isActive ? "Pause alert" : "Resume alert"}
                >
                  {alert.isActive ? <PauseCircle size={14} /> : <Bell size={14} />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(alert.id)}
                  data-testid={`button-delete-alert-${alert.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobSeekerDashboard({ section }: { section?: string }) {
  const { user } = useAuth();

  if (!user) return null;

  const content = () => {
    if (section === "resume") return <ResumeTab userId={user.id} />;
    if (section === "profile") return <SeekerProfileTab />;
    if (section === "quota") return <QuotaTab />;
    if (section === "membership") return <MembershipTab user={user} />;
    if (section === "alerts") return <JobAlertsTab />;
    if (section === "saved") return <SavedJobsTab />;
    return <ApplicationsTab userId={user.id} />;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {content()}
      </div>
    </DashboardLayout>
  );
}
