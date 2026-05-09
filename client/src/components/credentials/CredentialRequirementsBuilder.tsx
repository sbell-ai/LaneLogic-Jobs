import { useMemo, useState } from "react";
import { Plus, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  useAddRequirement,
  useJobRequirements,
  useRemoveRequirement,
  useUpdateRequirement,
  type JobRequirementWithCredential,
} from "@/hooks/use-job-requirements";
import type { CredentialType, RequirementLevel } from "@shared/schema";
import { CredentialTypePicker } from "./CredentialTypePicker";
import { RequirementRow } from "./RequirementRow";

type Props = { jobId: number };

export function CredentialRequirementsBuilder({ jobId }: Props) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: requirements = [], isLoading } = useJobRequirements(jobId);
  const addMutation = useAddRequirement(jobId);
  const updateMutation = useUpdateRequirement(jobId);
  const removeMutation = useRemoveRequirement(jobId);

  const { required, preferred, existingIds } = useMemo(() => {
    const req: JobRequirementWithCredential[] = [];
    const pref: JobRequirementWithCredential[] = [];
    for (const r of requirements) {
      if (r.requirement_level === "required") req.push(r);
      else pref.push(r);
    }
    return { required: req, preferred: pref, existingIds: requirements.map((r) => r.credential_type_id) };
  }, [requirements]);

  const handleSelect = (ct: CredentialType) => {
    addMutation.mutate(
      { credential_type_id: ct.id, requirement_level: "required" },
      {
        onError: (err: unknown) => {
          const message = err instanceof Error && err.message.includes("409")
            ? "That credential is already on this job."
            : "Could not add credential.";
          toast({ title: "Error", description: message, variant: "destructive" });
        },
      },
    );
  };

  const handleLevelChange = (req: JobRequirementWithCredential, level: RequirementLevel) => {
    if (level === req.requirement_level) return;
    updateMutation.mutate(
      { id: req.id, requirement_level: level },
      {
        onError: () =>
          toast({ title: "Error", description: "Could not update requirement.", variant: "destructive" }),
      },
    );
  };

  const handleRemove = (req: JobRequirementWithCredential) => {
    removeMutation.mutate(req.id, {
      onError: () =>
        toast({ title: "Error", description: "Could not remove requirement.", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4" data-testid="credential-requirements-builder">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Credential Requirements</h3>
          <p className="text-sm text-muted-foreground">
            Add the licenses and certifications candidates need for this job.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={addMutation.isPending}
          data-testid="add-credential-btn"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Credential
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading requirements...</div>
      ) : requirements.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
          No credential requirements yet. Add one to start matching candidates.
        </div>
      ) : (
        <div className="space-y-4">
          {required.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Required
              </div>
              <div className="space-y-2">
                {required.map((r) => (
                  <RequirementRow
                    key={r.id}
                    requirement={r}
                    onLevelChange={(level) => handleLevelChange(r, level)}
                    onRemove={() => handleRemove(r)}
                    disabled={updateMutation.isPending || removeMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
          {preferred.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Star className="h-3.5 w-3.5" /> Preferred
              </div>
              <div className="space-y-2">
                {preferred.map((r) => (
                  <RequirementRow
                    key={r.id}
                    requirement={r}
                    onLevelChange={(level) => handleLevelChange(r, level)}
                    onRemove={() => handleRemove(r)}
                    disabled={updateMutation.isPending || removeMutation.isPending}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <CredentialTypePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
        excludeIds={existingIds}
      />
    </div>
  );
}
