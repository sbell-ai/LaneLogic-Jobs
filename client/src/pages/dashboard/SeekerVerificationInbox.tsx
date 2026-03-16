import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight, Link as LinkIcon, Clock } from "lucide-react";
import type { SeekerVerificationRequest, SeekerCredentialEvidenceItem } from "@shared/schema";

type InboxItem = SeekerVerificationRequest & {
  seekerName: string | null;
  seekerEmail: string;
  evidence: SeekerCredentialEvidenceItem[];
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
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: items, isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/admin/seeker-verification/inbox"],
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
                  <Badge className={item.status === "submitted" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}>
                    {item.status === "submitted" ? <><Clock size={14} className="mr-1" /> Submitted</> : <><AlertCircle size={14} className="mr-1" /> Needs More</>}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.evidence.length} evidence item{item.evidence.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {expanded === item.id && (
                <div className="mt-4 space-y-3">
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
