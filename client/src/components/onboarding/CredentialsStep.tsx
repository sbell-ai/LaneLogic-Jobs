// Step 2 of the seeker wizard. Wraps Sprint 4's CredentialTypePicker
// (single-select modal) into a multi-select list-and-add UX. Persists each
// change to the parent so the page can save on Continue.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { CredentialTypePicker } from "@/components/credentials/CredentialTypePicker";
import type { CredentialType } from "@shared/schema";

type Props = {
  initial?: CredentialType[];
  onSave: (selected: CredentialType[]) => Promise<void>;
  onSkip: () => void;
  saving: boolean;
};

export function CredentialsStep({ initial = [], onSave, onSkip, saving }: Props) {
  const [selected, setSelected] = useState<CredentialType[]>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAdd = (ct: CredentialType) => {
    setSelected((prev) => (prev.some((p) => p.id === ct.id) ? prev : [...prev, ct]));
  };
  const handleRemove = (id: number) => setSelected((prev) => prev.filter((c) => c.id !== id));

  const handleContinue = async () => {
    await onSave(selected);
  };

  return (
    <Card className="p-6 space-y-5" data-testid="step-credentials">
      <div>
        <h2 className="text-xl font-bold">Your Credentials</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick all credentials you currently hold. We'll match you against jobs that require them.
        </p>
      </div>

      <div className="space-y-2">
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No credentials selected yet.</p>
        ) : (
          selected.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2"
              data-testid={`selected-cred-${c.code}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.code}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] capitalize">{c.modalNamespace}</Badge>
                <button
                  onClick={() => handleRemove(c.id)}
                  className="text-muted-foreground hover:text-foreground rounded p-1"
                  aria-label="Remove"
                  data-testid={`remove-cred-${c.code}`}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button variant="outline" onClick={() => setPickerOpen(true)} className="gap-2" data-testid="open-picker">
        <Plus size={14} />
        Add credential
      </Button>

      <CredentialTypePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAdd}
        excludeIds={selected.map((c) => c.id)}
      />

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          data-testid="skip-credentials"
        >
          I'll add credentials later
        </button>
        <Button onClick={handleContinue} disabled={saving} data-testid="credentials-continue">
          {saving ? "Saving…" : "Continue →"}
        </Button>
      </div>
    </Card>
  );
}
