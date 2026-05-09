import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RequirementLevel } from "@shared/schema";
import type { JobRequirementWithCredential } from "@/hooks/use-job-requirements";

type Props = {
  requirement: JobRequirementWithCredential;
  onLevelChange: (level: RequirementLevel) => void;
  onRemove: () => void;
  disabled?: boolean;
};

export function RequirementRow({ requirement, onLevelChange, onRemove, disabled }: Props) {
  const ct = requirement.credential_type;
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-background"
      data-testid={`requirement-row-${ct.code}`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{ct.name}</div>
        {ct.issuingAuthority && (
          <div className="text-xs text-muted-foreground">{ct.issuingAuthority}</div>
        )}
      </div>
      <Badge variant="outline" className="hidden sm:inline-flex capitalize">
        {ct.modalNamespace}
      </Badge>
      <Select
        value={requirement.requirement_level}
        onValueChange={(v) => onLevelChange(v as RequirementLevel)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px]" data-testid={`level-select-${ct.code}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="required">Required</SelectItem>
          <SelectItem value="preferred">Preferred</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove credential"
        data-testid={`remove-${ct.code}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
