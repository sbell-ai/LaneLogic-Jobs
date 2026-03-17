import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight, Link as LinkIcon, Clock, User } from "lucide-react";
import type { SeekerVerificationRequest, SeekerCredentialEvidenceItem } from "@shared/schema";

type InboxItem = SeekerVerificationRequest & {
  seekerName: string | null;
  seekerEmail: string;
  seekerTrack: string | null;
  cdlIsNonDomiciled: boolean;
  cdlMarkedNonDomiciledIssuingState: boolean;
  evidence: SeekerCredentialEvidenceItem[];
  requirementLabels: string[];
};

const SOURCE_LABELS: Record<string, string> = {
  license_photo: "License / Card Photo",
  certificate: "Certificate",
  training_record: "Training Record",
  government_registry: "Government Registry Link",
  employer_letter: "Employer Verification Letter",
  other: "Other",
};

function DecisionPanel({ item, onComplete }: { item: InboxItem; onComplete: () => void }) {
  const [notes, setNotes] = useState(item.adminNotes || "");
  const { toast } = useToast();

  const decisionMutation = useMutation({
    mutationFn: (decision: "verified" | "rejected" | "needs_more") =>
      apiRequest("POST", "/api/admin/seeker-verification/request/decision", {
        requestId: item.id,
        decision,
        adminNotes: notes || undefined,
      }),
    onSuccess: (_, decision) => {
      toast({ title: `Request ${decision === "verified" ? "approved" : decision === "rejected" ? "rejected" : "sent back"}` });
      onComplete();
    },
    onError: () => toast({ title: "Error", description: "Could not process decision.", variant: "destructive" }),
  });

  return (
    <div className="border-t pt-4 mt-4 space-y-3">
      <div>
        <label className="text-sm font-medium mb-1 block">Admin Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes for the job seeker..."
          data-testid={`input-seeker-admin-notes-${item.id}`}
        />
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => decisionMutation.mutate("verified")}
          disabled={decisionMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
          data-testid={`button-seeker-approve-${item.id}`}
        >
          <CheckCircle2 size={16} className="mr-1" /> Approve
        </Button>
        <Button
          onClick={() => decisionMutation.mutate("needs_more")}
          disabled={decisionMutation.isPending}
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-50"
          data-testid={`button-seeker-needs-more-${item.id}`}
        >
          <AlertCircle size={16} className="mr-1" /> Needs More
        </Button>
        <Button
          onClick={() => decisionMutation.mutate("rejected")}
          disabled={decisionMutation.isPending}
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          data-testid={`button-seeker-reject-${item.id}`}
        >
          <XCircle size={16} className="mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}

export default function SeekerVerificationInbox() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: items, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/admin/seeker-verification/inbox"],
  });

  const nonDomiciledStateMutation = useMutation({
    mutationFn: ({ seekerId, cdlMarkedNonDomiciledIssuingState }: { seekerId: number; cdlMarkedNonDomiciledIssuingState: boolean }) =>
      apiRequest("POST", "/api/admin/seeker-verification/set-cdl-non-domiciled-state", { seekerId, cdlMarkedNonDomiciledIssuingState }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/seeker-verification/inbox"] });
      toast({ title: "Flag updated" });
    },
    onError: () => toast({ title: "Error", description: "Could not update flag.", variant: "destructive" }),
  });

  const handleComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/seeker-verification/inbox"] });
    setExpanded(null);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={24} className="text-primary" />
        <h2 className="text-2xl font-bold font-display" data-testid="text-seeker-verification-inbox-heading">Seeker Credential Verification</h2>
      </div>

      {isLoading && (
        <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />
      )}

      {!isLoading && (!items || items.length === 0) && (
        <Card className="p-8 text-center" data-testid="card-seeker-empty-inbox">
          <ShieldCheck size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No pending seeker verification requests.</p>
        </Card>
      )}

      {!isLoading && items && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5" data-testid={`card-seeker-verification-request-${item.id}`}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                data-testid={`button-seeker-expand-${item.id}`}
              >
                <div className="flex items-center gap-3">
                  {expanded === item.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <div>
                    <p className="font-semibold">{item.seekerName || item.seekerEmail}</p>
                    <p className="text-sm text-muted-foreground">{item.seekerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.seekerTrack && item.seekerTrack !== "Unknown" && (
                    <Badge variant="outline" className="text-xs" data-testid={`badge-seeker-track-${item.id}`}>
                      <User size={12} className="mr-1" /> {item.seekerTrack}
                    </Badge>
                  )}
                  <Badge className={item.status === "submitted" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}>
                    {item.status === "submitted" ? <><Clock size={14} className="mr-1" /> Submitted</> : <><AlertCircle size={14} className="mr-1" /> Needs More</>}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.evidence.length} evidence item{item.evidence.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {expanded === item.id && (
                <div className="mt-4 space-y-3">
                  {item.requirementsSnapshot && item.requirementsSnapshot.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3" data-testid={`section-required-credentials-${item.id}`}>
                      <p className="text-sm font-medium mb-2">Required Credentials</p>
                      <div className="flex flex-wrap gap-2">
                        {item.requirementLabels.map((label, i) => {
                          const key = item.requirementsSnapshot![i];
                          const hasEvidence = item.evidence.some(e => e.requirementKey === key);
                          return (
                            <Badge
                              key={key}
                              variant="outline"
                              className={`text-xs ${hasEvidence ? "border-green-300 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`}
                            >
                              {hasEvidence ? <CheckCircle2 size={12} className="mr-1" /> : <XCircle size={12} className="mr-1" />}
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium mb-2">Evidence Items</p>
                    {item.evidence.map((ev) => (
                      <div key={ev.id} className="border rounded-lg p-3 mb-2" data-testid={`card-seeker-admin-evidence-${ev.id}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="text-xs bg-primary/10 text-primary">{ev.requirementKey}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[ev.sourceType] || ev.sourceType}
                          </Badge>
                        </div>
                        {ev.sourceUrl && (
                          <p className="text-sm flex items-center gap-1 text-blue-600">
                            <LinkIcon size={14} /> <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer">{ev.sourceUrl}</a>
                          </p>
                        )}
                        {ev.claim && <p className="text-sm mt-1"><span className="font-medium">Claim:</span> {ev.claim}</p>}
                        {ev.excerpt && <p className="text-sm mt-1 text-muted-foreground italic">"{ev.excerpt}"</p>}
                      </div>
                    ))}
                    {item.evidence.length === 0 && (
                      <p className="text-sm text-muted-foreground">No evidence items attached.</p>
                    )}
                  </div>
                  <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900" data-testid={`card-admin-cdl-non-domiciled-${item.id}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Issuing state marks CDL as non-domiciled</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Enable if the seeker's issuing state has confirmed their CDL is classified as non-domiciled. This triggers the 2026 non-domiciled requirements for the seeker.
                        </p>
                        {item.cdlIsNonDomiciled && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Seeker has self-reported as non-domiciled</p>
                        )}
                      </div>
                      <Switch
                        checked={item.cdlMarkedNonDomiciledIssuingState}
                        onCheckedChange={(val) => nonDomiciledStateMutation.mutate({ seekerId: item.seekerId, cdlMarkedNonDomiciledIssuingState: val })}
                        disabled={nonDomiciledStateMutation.isPending}
                        data-testid={`toggle-admin-cdl-non-domiciled-${item.id}`}
                      />
                    </div>
                  </div>
                  <DecisionPanel item={item} onComplete={handleComplete} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
