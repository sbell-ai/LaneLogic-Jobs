import { useState } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, Send, FileText, Link as LinkIcon, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Redirect } from "wouter";
import type { SeekerVerificationRequest, SeekerCredentialEvidenceItem, SeekerCredentialRequirement } from "@shared/schema";

const SOURCE_TYPES = [
  { value: "license_photo", label: "License / Card Photo" },
  { value: "certificate", label: "Certificate" },
  { value: "training_record", label: "Training Record" },
  { value: "government_registry", label: "Government Registry Link" },
  { value: "employer_letter", label: "Employer Verification Letter" },
  { value: "other", label: "Other" },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="gap-1" data-testid="badge-seeker-status-draft"><FileText size={14} /> Draft</Badge>;
    case "submitted":
      return <Badge className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid="badge-seeker-status-submitted"><Clock size={14} /> Submitted</Badge>;
    case "needs_more":
      return <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-seeker-status-needs-more"><AlertCircle size={14} /> Needs More Info</Badge>;
    case "verified":
      return <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-seeker-status-verified"><CheckCircle2 size={14} /> Verified</Badge>;
    case "rejected":
      return <Badge className="gap-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" data-testid="badge-seeker-status-rejected"><XCircle size={14} /> Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function SeekerVerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [requirementKey, setRequirementKey] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [claim, setClaim] = useState("");

  const cdlNonDomiciledMutation = useMutation({
    mutationFn: (cdlIsNonDomiciled: boolean) =>
      apiRequest("POST", "/api/seeker/cdl-non-domiciled", { cdlIsNonDomiciled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seeker/verification/requirements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Preference saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save preference.", variant: "destructive" }),
  });

  const isSeeker = !!user && user.role === "job_seeker";

  const { data, isLoading } = useQuery<{ request: SeekerVerificationRequest | null; evidence: SeekerCredentialEvidenceItem[] }>({
    queryKey: ["/api/seeker/verification/request"],
    enabled: isSeeker,
  });

  const { data: reqData } = useQuery<{ requirements: SeekerCredentialRequirement[]; allRequirements: SeekerCredentialRequirement[] }>({
    queryKey: ["/api/seeker/verification/requirements"],
    enabled: isSeeker,
  });

  const getOrCreateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seeker/verification/request/get-or-create"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seeker/verification/request"] });
      toast({ title: "Verification request created", description: "Add your credential evidence below." });
    },
    onError: () => toast({ title: "Error", description: "Could not create verification request.", variant: "destructive" }),
  });

  const addEvidenceMutation = useMutation({
    mutationFn: (item: { requestId: number; requirementKey: string; sourceType: string; sourceUrl?: string | null; excerpt?: string | null; claim?: string | null }) =>
      apiRequest("POST", "/api/seeker/verification/evidence", item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seeker/verification/request"] });
      setRequirementKey("");
      setSourceType("");
      setSourceUrl("");
      setExcerpt("");
      setClaim("");
      toast({ title: "Evidence added" });
    },
    onError: () => toast({ title: "Error", description: "Could not add evidence.", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/seeker/verification/request/submit"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seeker/verification/request"] });
      toast({ title: "Request submitted!", description: "Our team will review your credentials." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Could not submit.", variant: "destructive" }),
  });

  if (!user || user.role !== "job_seeker") {
    return <Redirect to="/" />;
  }

  const request = data?.request;
  const evidence = data?.evidence || [];
  const allRequirements = reqData?.allRequirements || [];
  const computedRequirements = reqData?.requirements || [];
  const canEdit = !request || request.status === "draft" || request.status === "needs_more";
  const snapshot = request?.requirementsSnapshot ?? [];
  const evidenceKeys = new Set(evidence.map(e => e.requirementKey));
  const missingKeys = (snapshot || []).filter(k => !evidenceKeys.has(k));
  const canSubmit = request && (request.status === "draft" || request.status === "needs_more") && evidence.length > 0 && missingKeys.length === 0;

  const requirementOptions = allRequirements.length > 0 ? allRequirements : [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display" data-testid="text-seeker-verification-heading">Credential Verification</h1>
            <p className="text-muted-foreground text-sm">Verify your licenses and credentials to stand out to employers</p>
          </div>
        </div>

        <Card className="p-5 mb-6" data-testid="card-cdl-non-domiciled-toggle">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">My CDL is non-domiciled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select if your CDL was issued to you as a non-domiciled resident under FMCSA rules. This will add 2026 non-domiciled CDL requirements to your verification.
              </p>
            </div>
            <Switch
              checked={!!(user as any).cdlIsNonDomiciled}
              onCheckedChange={(val) => cdlNonDomiciledMutation.mutate(val)}
              disabled={cdlNonDomiciledMutation.isPending}
              data-testid="toggle-cdl-non-domiciled"
            />
          </div>
        </Card>

        {computedRequirements.length > 0 && (
          <Card className="p-5 mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800" data-testid="card-recommended-credentials">
            <h3 className="font-semibold text-sm mb-2">Recommended for your profile</h3>
            <div className="flex flex-wrap gap-2">
              {computedRequirements.map(r => (
                <Badge key={r.key} variant="outline" className="text-xs bg-white dark:bg-slate-900">
                  {r.label}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {isLoading && (
          <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        )}

        {!isLoading && !request && (
          <Card className="p-8 text-center" data-testid="card-no-seeker-request">
            <ShieldCheck size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Get Your Credentials Verified</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Verified credentials like CDL licenses and safety certifications help you stand out and build trust with employers.
            </p>
            <Button
              onClick={() => getOrCreateMutation.mutate()}
              disabled={getOrCreateMutation.isPending}
              data-testid="button-request-seeker-verification"
            >
              {getOrCreateMutation.isPending ? "Creating..." : "Start Verification"}
            </Button>
          </Card>
        )}

        {!isLoading && request && (
          <div className="space-y-6">
            <Card className="p-6" data-testid="card-seeker-request-status">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Verification Request</h2>
                <StatusBadge status={request.status} />
              </div>
              {request.adminNotes && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4" data-testid="text-seeker-admin-notes">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Admin Notes</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{request.adminNotes}</p>
                </div>
              )}
              {request.status === "submitted" && (
                <p className="text-sm text-muted-foreground">Your credentials are being reviewed. We'll update you soon.</p>
              )}
              {request.status === "verified" && (
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400 mb-3">Your credentials have been verified!</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => getOrCreateMutation.mutate()}
                    disabled={getOrCreateMutation.isPending}
                    data-testid="button-start-new-request-verified"
                  >
                    {getOrCreateMutation.isPending ? "Creating..." : "Update Credentials"}
                  </Button>
                </div>
              )}
              {request.status === "rejected" && (
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-3">Your verification request was not approved. You may submit a new request.</p>
                  <Button
                    size="sm"
                    onClick={() => getOrCreateMutation.mutate()}
                    disabled={getOrCreateMutation.isPending}
                    data-testid="button-start-new-request"
                  >
                    {getOrCreateMutation.isPending ? "Creating..." : "Start New Request"}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-6" data-testid="card-seeker-evidence-list">
              <h2 className="text-lg font-semibold mb-4">Evidence Items ({evidence.length})</h2>
              {evidence.length === 0 && (
                <p className="text-sm text-muted-foreground mb-4">No evidence items yet. Add at least one to submit your request.</p>
              )}
              <div className="space-y-3">
                {evidence.map((item) => {
                  const reqLabel = allRequirements.find(r => r.key === item.requirementKey)?.label || item.requirementKey;
                  return (
                    <div key={item.id} className="border rounded-lg p-4" data-testid={`card-seeker-evidence-${item.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="text-xs bg-primary/10 text-primary">{reqLabel}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_TYPES.find(t => t.value === item.sourceType)?.label || item.sourceType}
                        </Badge>
                      </div>
                      {item.sourceUrl && (
                        <p className="text-sm flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <LinkIcon size={14} /> <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceUrl}</a>
                        </p>
                      )}
                      {item.claim && <p className="text-sm mt-1"><span className="font-medium">Claim:</span> {item.claim}</p>}
                      {item.excerpt && <p className="text-sm mt-1 text-muted-foreground italic">"{item.excerpt}"</p>}
                    </div>
                  );
                })}
              </div>
            </Card>

            {canEdit && (
              <Card className="p-6" data-testid="card-add-seeker-evidence">
                <h2 className="text-lg font-semibold mb-4">Add Evidence</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Credential *</label>
                    <Select value={requirementKey} onValueChange={setRequirementKey}>
                      <SelectTrigger data-testid="select-seeker-requirement">
                        <SelectValue placeholder="Select credential..." />
                      </SelectTrigger>
                      <SelectContent>
                        {requirementOptions.map(r => (
                          <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Source Type *</label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger data-testid="select-seeker-source-type">
                        <SelectValue placeholder="Select source type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Source URL</label>
                    <Input
                      placeholder="https://..."
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      data-testid="input-seeker-source-url"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Claim</label>
                    <Input
                      placeholder="What does this evidence prove?"
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      data-testid="input-seeker-claim"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Excerpt / Notes</label>
                    <Textarea
                      placeholder="Relevant details, license number, or additional notes..."
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      data-testid="input-seeker-excerpt"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (!requirementKey) {
                        toast({ title: "Error", description: "Please select a credential.", variant: "destructive" });
                        return;
                      }
                      if (!sourceType) {
                        toast({ title: "Error", description: "Please select a source type.", variant: "destructive" });
                        return;
                      }
                      addEvidenceMutation.mutate({
                        requestId: request!.id,
                        requirementKey,
                        sourceType,
                        sourceUrl: sourceUrl || null,
                        excerpt: excerpt || null,
                        claim: claim || null,
                      });
                    }}
                    disabled={addEvidenceMutation.isPending || !requirementKey || !sourceType}
                    variant="outline"
                    data-testid="button-add-seeker-evidence"
                  >
                    <Plus size={16} className="mr-1" />
                    {addEvidenceMutation.isPending ? "Adding..." : "Add Evidence"}
                  </Button>
                </div>
              </Card>
            )}

            {canEdit && missingKeys.length > 0 && (
              <Card className="p-5 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800" data-testid="card-missing-credentials">
                <h3 className="font-semibold text-sm mb-2 text-amber-800 dark:text-amber-200">Missing Required Evidence</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">Add evidence for the following credentials before submitting:</p>
                <div className="flex flex-wrap gap-2">
                  {missingKeys.map(k => {
                    const label = allRequirements.find(r => r.key === k)?.label || k;
                    return (
                      <Badge key={k} variant="outline" className="text-xs border-amber-300 bg-white dark:bg-slate-900">
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </Card>
            )}

            {canSubmit && (
              <div className="flex justify-end">
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  size="lg"
                  data-testid="button-submit-seeker-verification"
                >
                  <Send size={16} className="mr-2" />
                  {submitMutation.isPending ? "Submitting..." : "Submit for Review"}
                </Button>
              </div>
            )}

            {request && canEdit && evidence.length > 0 && missingKeys.length > 0 && (
              <p className="text-sm text-muted-foreground text-right">
                Submit button will appear once all required credentials have evidence.
              </p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
