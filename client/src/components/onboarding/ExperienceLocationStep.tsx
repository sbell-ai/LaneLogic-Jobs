// Step 3 of the seeker wizard. Years (number input, 0–50) plus a best-effort
// browser geolocation. If the user denies or the browser can't get a fix,
// we proceed without storing lat/lng — never block.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, AlertCircle, CheckCircle2 } from "lucide-react";

export type ExperienceLocationValues = {
  yearsExperience: number | null;
  lat: number | null;
  lng: number | null;
};

type Props = {
  initial?: ExperienceLocationValues;
  onSave: (values: ExperienceLocationValues) => Promise<void>;
  onBack: () => void;
  saving: boolean;
  ctaLabel?: string;
};

type GeoState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; lat: number; lng: number }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function ExperienceLocationStep({
  initial,
  onSave,
  onBack,
  saving,
  ctaLabel = "Continue →",
}: Props) {
  const [years, setYears] = useState<string>(
    initial?.yearsExperience != null ? String(initial.yearsExperience) : "",
  );
  const [geo, setGeo] = useState<GeoState>(
    initial?.lat != null && initial?.lng != null
      ? { kind: "ready", lat: initial.lat, lng: initial.lng }
      : { kind: "idle" },
  );

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ kind: "error", message: "Geolocation not available in this browser." });
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
    const yrs = years.trim() === "" ? null : Math.max(0, Math.min(50, parseInt(years, 10) || 0));
    const lat = geo.kind === "ready" ? geo.lat : null;
    const lng = geo.kind === "ready" ? geo.lng : null;
    await onSave({ yearsExperience: yrs, lat, lng });
  };

  return (
    <Card className="p-6 space-y-5" data-testid="step-experience-location">
      <div>
        <h2 className="text-xl font-bold">Experience &amp; Location</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Two quick details that help us find better matches.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="years-experience">
          Years of commercial driving / transport experience
        </label>
        <Input
          id="years-experience"
          type="number"
          min={0}
          max={50}
          inputMode="numeric"
          placeholder="e.g. 5"
          value={years}
          onChange={(e) => setYears(e.target.value)}
          data-testid="input-years"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Your general location
          <span className="text-xs font-normal text-muted-foreground ml-1">
            — used for distance matching, never shared publicly
          </span>
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={requestLocation}
            disabled={geo.kind === "loading"}
            className="gap-2"
            data-testid="request-location"
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
              <CheckCircle2 size={12} />
              Captured ({geo.lat.toFixed(2)}, {geo.lng.toFixed(2)})
            </span>
          )}
          {geo.kind === "denied" && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <AlertCircle size={12} />
              Permission denied — that's okay, we'll skip distance matching
            </span>
          )}
          {geo.kind === "error" && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <AlertCircle size={12} />
              {geo.message}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} data-testid="experience-back">← Back</Button>
        <Button onClick={handleContinue} disabled={saving} data-testid="experience-continue">
          {saving ? "Saving…" : ctaLabel}
        </Button>
      </div>
    </Card>
  );
}
