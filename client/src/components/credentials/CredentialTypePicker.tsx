import { useMemo } from "react";
import { useCredentialTypes } from "@/hooks/use-credential-types";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { CredentialType, ModalNamespace } from "@shared/schema";

const NAMESPACE_LABELS: Record<ModalNamespace, string> = {
  trucking: "Trucking",
  maritime: "Maritime",
  aviation: "Aviation",
  logistics: "3/4PL & Logistics",
};

const NAMESPACE_ORDER: ModalNamespace[] = ["trucking", "maritime", "aviation", "logistics"];
const SELECTABLE_NAMESPACES: ModalNamespace[] = ["trucking"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (credentialType: CredentialType) => void;
  excludeIds?: number[];
};

export function CredentialTypePicker({ open, onOpenChange, onSelect, excludeIds = [] }: Props) {
  const { data, isLoading } = useCredentialTypes();
  const excluded = new Set(excludeIds);

  const groups = useMemo(() => {
    const map = new Map<ModalNamespace, CredentialType[]>();
    for (const ns of NAMESPACE_ORDER) map.set(ns, []);
    for (const ct of data ?? []) {
      if (excluded.has(ct.id)) continue;
      const arr = map.get(ct.modalNamespace);
      if (arr) arr.push(ct);
    }
    return map;
  }, [data, excluded]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search credentials by name or code..." />
      <CommandList>
        {isLoading ? (
          <CommandEmpty>Loading...</CommandEmpty>
        ) : (
          <CommandEmpty>No credentials found.</CommandEmpty>
        )}
        {NAMESPACE_ORDER.map((ns) => {
          const items = groups.get(ns) ?? [];
          if (items.length === 0 && ns !== "trucking") {
            // Show namespace heading with "Coming soon" placeholder so the roadmap is visible.
            return (
              <CommandGroup key={ns} heading={NAMESPACE_LABELS[ns]}>
                <CommandItem disabled className="opacity-60" data-testid={`coming-soon-${ns}`}>
                  <span className="flex-1 italic">No credentials yet</span>
                  <Badge variant="secondary">Coming soon</Badge>
                </CommandItem>
              </CommandGroup>
            );
          }
          if (items.length === 0) return null;
          const selectable = SELECTABLE_NAMESPACES.includes(ns);
          return (
            <CommandGroup key={ns} heading={NAMESPACE_LABELS[ns]}>
              {items.map((ct) => (
                <CommandItem
                  key={ct.id}
                  value={`${ct.name} ${ct.code}`}
                  disabled={!selectable}
                  onSelect={() => {
                    if (!selectable) return;
                    onSelect(ct);
                    onOpenChange(false);
                  }}
                  className={selectable ? undefined : "opacity-60 cursor-not-allowed"}
                  data-testid={`credential-option-${ct.code}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ct.name}</div>
                    {ct.issuingAuthority && (
                      <div className="text-xs text-muted-foreground">{ct.issuingAuthority}</div>
                    )}
                  </div>
                  {!selectable && <Badge variant="secondary">Coming soon</Badge>}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
