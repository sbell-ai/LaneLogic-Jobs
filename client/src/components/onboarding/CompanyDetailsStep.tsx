// Step 2 of the employer wizard. Reuses the same best-effort geolocation
// pattern as the seeker step.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, AlertCircle, CheckCircle2 } from "lucide-react";
import { MODAL_NAMESPACES, type ModalNamespace } from "@shared/schema";

const MODAL_LABELS: Record<ModalNamespace, string> = {
  trucking: "Trucking",
  maritime: "Maritime",
  aviation: "Aviation",
  logistics: "Logistics",
};

export type CompanyDetailsValues = {
  companyName: string | null;
  dotNumber: string | null;
  mcNumber: string | null;
  primaryModal: ModalNamespace;
  lat: number | null;
  lng: number | null;
};

type Props = {
  initial?: Partial<CompanyDetailsValues>;
  onSave: (values: CompanyDetailsValues) => Promise<void>;
  onBack: () => void;
  saving: boolean;
};

type GeoState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; lat: number; lng: number }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function CompanyDetailsStep({ initial, onSave, onBack, saving }: Props) {
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [dotNumber, setDotNumber] = useState(initial?.dotNumber ?? "");
  const [mcNumber, setMcNumber] = useState(initial?.mcNumber ?? "");
  const [primaryModal, setPrimaryModal] = useState<ModalNamespace>(initial?.primaryModal ?? "trucking");
  const [geo, setGeo] = useState<GeoState>(
    initial?.lat != null && initial?.lng != null
      ? { kind: "ready", lat: initial.lat, lng: initial.lng }
      : { kind: "idle" },
  );

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ kind: "error", message: "Geolocation not available." });
      return;
    }
    setGeo({ kind: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ kind: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeo({ kind: "denied" });
        else setGeo({ kind: "error", message: err.message });
      },
      { timeout: 10000, maximumAge: 60_000 },
    );
  };

  const handleContinue = async () => {
    await onSave({
      companyName: companyName.trim() || null,
      dotNumber: dotNumber.trim() || null,
      mcNumber: mcNumber.trim() || null,
      primaryModal,
      lat: geo.kind === "ready" ? geo.lat : null,
      lng: geo.kind === "ready" ? geo.lng : null,
    });
  };

  return (
    <Card className="p-6 space-y-5" data-testid="step-company-details">
      <div>
        <h2 className="text-xl font-bold">Company details</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about your company. You can edit these any time from your profile.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="company-name">Company name</label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Midwest Freight Co."
          data-testid="input-company-name"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="dot-number">DOT number <span className="text-xs font-normal text-muted-foreground">(optional)</span></label>
          <Input id="dot-number" value={dotNumber} onChange={(e) => setDotNumber(e.target.value)} data-testid="input-dot-number" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="mc-number">MC number <span className="text-xs font-normal text-muted-foreground">(optional)</span></label>
          <Input id="mc-number" value={mcNumber} onChange={(e) => setMcNumber(e.target.value)} data-testid="input-mc-number" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Primary modal</label>
        <Select value={primaryModal} onValueChange={(v) => setPrimaryModal(v as ModalNamespace)}>
          <SelectTrigger data-testid="select-primary-modal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODAL_NAMESPACES.map((m) => (
              <SelectItem key={m} value={m}>{MODAL_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Company location</label>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={requestLocation}
            disabled={geo.kind === "loading"}
            className="gap-2"
            data-testid="request-company-location"
          >
            <MapPin size={14} />
            {geo.kind === "loading"
              ? "Getting location…"
              : geo.kind === "ready"
              ? "Update location"
              : "Use current location"}
          </Button>
          {geo.kind === "ready" && (
            <span className="text-xs text-green-700 dark:text-green-400 inline-flex items-center gap-1">
              <CheckCircle2 size={12} /> Captured
            </span>
          )}
          {(geo.kind === "denied" || geo.kind === "error") && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <AlertCircle size={12} />
              {geo.kind === "denied" ? "Permission denied — that's okay" : geo.message}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} data-testid="company-back">← Back</Button>
        <Button onClick={handleContinue} disabled={saving} data-testid="company-continue">
          {saving ? "Saving…" : "Continue →"}
        </Button>
      </div>
    </Card>
  );
}
