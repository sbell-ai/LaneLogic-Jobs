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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, Send, FileText, Link as LinkIcon, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { EmployerVerificationRequest, EmployerEvidenceItem } from "@shared/schema";

const SOURCE_TYPES = [
  { value: "dot_number", label: "DOT / MC Number" },
  { value: "business_registration", label: "Business Registration" },
  { value: "website", label: "Company Website" },
  { value: "insurance_certificate", label: "Insurance Certificate" },
  { value: "industry_association", label: "Industry Association Membership" },
  { value: "other", label: "Other" },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline" className="gap-1" data-testid="badge-status-draft"><FileText size={14} /> Draft</Badge>;
    case "submitted":
      return <Badge className="gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid="badge-status-submitted"><Clock size={14} /> Submitted</Badge>;
    case "needs_more":
      return <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" data-testid="badge-status-needs-more"><AlertCircle size={14} /> Needs More Info</Badge>;
    case "verified":
      return <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-status-verified"><CheckCircle2 size={14} /> Verified</Badge>;
    case "rejected":
      return <Badge className="gap-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" data-testid="badge-status-rejected"><XCircle size={14} /> Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function VerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sourceType, setSourceType] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [claim, setClaim] = useState("");

  const { data, isLoading } = useQuery<{ request: EmployerVerificationRequest | null; evidence: EmployerEvidenceItem[] }>({
    queryKey: ["/api/employer/verification/request"],
    enabled: !!user,
  });

  const getOrCreateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/employer/verification/request/get-or-create"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/verification/request"] });
      toast({ title: "Verification request created", description: "Add your evidence documents below." });
    },
    onError: () => toast({ title: "Error", description: "Could not create verification request.", variant: "destructive" }),
  });

  const addEvidenceMutation = useMutation({
    mutationFn: (item: { requestId: number; sourceType: string; sourceUrl?: string | null; excerpt?: string | null; claim?: string | null }) =>
      apiRequest("POST", "/api/employer/verification/evidence", item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/verification/request"] });
      setSourceType("");
      setSourceUrl("");
      setExcerpt("");
      setClaim("");
      toast({ title: "Evidence added" });
    },
    onError: () => toast({ title: "Error", description: "Could not add evidence.", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/employer/verification/request/submit"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employer/verification/request"] });
      toast({ title: "Request submitted!", description: "Our team will review your verification request." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message || "Could not submit.", variant: "destructive" }),
  });

  if (!user) return null;

  const request = data?.request;
  const evidence = data?.evidence || [];
  const canEdit = !request || request.status === "draft" || request.status === "needs_more";
  const canSubmit = request && (request.status === "draft" || request.status === "needs_more") && evidence.length > 0;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display" data-testid="text-verification-heading">Employer Verification</h1>
            <p className="text-muted-foreground text-sm">Get verified to build trust with job seekers</p>
          </div>
        </div>

        {isLoading && (
          <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        )}

        {!isLoading && !request && (
          <Card className="p-8 text-center" data-testid="card-no-request">
            <ShieldCheck size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Become a Verified Employer</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Verified employers get a badge on their profile and job listings, increasing trust and application rates.
            </p>
            <Button
              onClick={() => getOrCreateMutation.mutate()}
              disabled={getOrCreateMutation.isPending}
              data-testid="button-request-verification"
            >
              {getOrCreateMutation.isPending ? "Creating..." : "Request Verification"}
            </Button>
          </Card>
        )}

        {!isLoading && request && (
          <div className="space-y-6">
            <Card className="p-6" data-testid="card-request-status">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Verification Request</h2>
                <StatusBadge status={request.status} />
              </div>
              {request.adminNotes && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4" data-testid="text-admin-notes">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">Admin Notes</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{request.adminNotes}</p>
                </div>
              )}
              {request.status === "submitted" && (
                <p className="text-sm text-muted-foreground">Your request is being reviewed. We'll update you soon.</p>
              )}
              {request.status === "verified" && (
                <p className="text-sm text-green-600 dark:text-green-400">Your company has been verified!</p>
              )}
              {request.status === "rejected" && (
                <p className="text-sm text-red-600 dark:text-red-400">Your verification request was not approved. You may submit a new request.</p>
              )}
            </Card>

            <Card className="p-6" data-testid="card-evidence-list">
              <h2 className="text-lg font-semibold mb-4">Evidence Items ({evidence.length})</h2>
              {evidence.length === 0 && (
                <p className="text-sm text-muted-foreground mb-4">No evidence items yet. Add at least one to submit your request.</p>
              )}
              <div className="space-y-3">
                {evidence.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4" data-testid={`card-evidence-${item.id}`}>
                    <div className="flex items-center gap-2 mb-2">
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
                ))}
              </div>
            </Card>

            {canEdit && (
              <Card className="p-6" data-testid="card-add-evidence">
                <h2 className="text-lg font-semibold mb-4">Add Evidence</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Source Type *</label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger data-testid="select-source-type">
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
                      data-testid="input-source-url"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Claim</label>
                    <Input
                      placeholder="What does this evidence prove?"
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      data-testid="input-claim"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Excerpt / Notes</label>
                    <Textarea
                      placeholder="Relevant excerpt or additional notes..."
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      data-testid="input-excerpt"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      if (!sourceType) {
                        toast({ title: "Error", description: "Please select a source type.", variant: "destructive" });
                        return;
                      }
                      addEvidenceMutation.mutate({
                        requestId: request!.id,
                        sourceType,
                        sourceUrl: sourceUrl || null,
                        excerpt: excerpt || null,
                        claim: claim || null,
                      });
                    }}
                    disabled={addEvidenceMutation.isPending || !sourceType}
                    variant="outline"
                    data-testid="button-add-evidence"
                  >
                    <Plus size={16} className="mr-1" />
                    {addEvidenceMutation.isPending ? "Adding..." : "Add Evidence"}
                  </Button>
                </div>
              </Card>
            )}

            {canSubmit && (
              <div className="flex justify-end">
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  size="lg"
                  data-testid="button-submit-verification"
                >
                  <Send size={16} className="mr-2" />
                  {submitMutation.isPending ? "Submitting..." : "Submit for Review"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
