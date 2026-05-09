import { useState, useEffect } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Save, CheckCircle2 } from "lucide-react";
import { Link, Redirect } from "wouter";
import {
  CDL_ENDORSEMENTS,
  CDL_RESTRICTIONS,
  CDL_CLASSES,
  type CdlEndorsement,
  type CdlRestriction,
  type CdlClass,
} from "@shared/certEnums";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENDORSEMENT_LABELS: Record<CdlEndorsement, string> = {
  H: "H — Hazardous Materials",
  N: "N — Tank Vehicles",
  T: "T — Double/Triple Trailers",
  X: "X — HazMat + Tank (combo)",
  P: "P — Passenger",
  S: "S — School Bus",
};

const RESTRICTION_LABELS: Record<CdlRestriction, string> = {
  L: "L — No air brakes",
  Z: "Z — No full air brakes",
  E: "E — No manual transmission",
  O: "O — No tractor-trailer",
  M: "M — Class B CDL only",
  N: "N — Class C CDL only",
  K: "K — Intrastate only",
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CertProfile = {
  cdlClass: CdlClass | null;
  cdlState: string | null;
  cdlEndorsements: CdlEndorsement[];
  cdlRestrictions: CdlRestriction[];
  cdlExpiresAt: string | null;
  yearsExperience: number | null;
  hasHazmat: boolean;
  hasTanker: boolean;
  hasDoubleTriple: boolean;
  hasPassenger: boolean;
  hasSchoolBus: boolean;
  updatedAt: string | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeekerCertProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (!user) return <Redirect to="/auth" />;
  if (user.role !== "job_seeker") return <Redirect to="/" />;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [cdlClass, setCdlClass] = useState<CdlClass | "none">("none");
  const [cdlState, setCdlState] = useState<string>("none");
  const [endorsements, setEndorsements] = useState<Set<CdlEndorsement>>(new Set());
  const [restrictions, setRestrictions] = useState<Set<CdlRestriction>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");

  // ── Load existing profile ───────────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery<CertProfile>({
    queryKey: ["/api/seeker/cert-profile"],
    retry: false,
    // 404 = no profile yet — not an error we surface
  });

  useEffect(() => {
    if (!profile) return;
    setCdlClass(profile.cdlClass ?? "none");
    setCdlState(profile.cdlState ?? "none");
    setEndorsements(new Set(profile.cdlEndorsements ?? []));
    setRestrictions(new Set(profile.cdlRestrictions ?? []));
    setExpiresAt(
      profile.cdlExpiresAt
        ? new Date(profile.cdlExpiresAt).toISOString().split("T")[0]
        : ""
    );
    setYearsExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
  }, [profile]);

  // ── Save mutation ───────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: object) => apiRequest("PUT", "/api/seeker/cert-profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seeker/cert-profile"] });
      toast({ title: "Cert profile saved", description: "Your credentials have been updated." });
    },
    onError: () =>
      toast({ title: "Error", description: "Could not save cert profile.", variant: "destructive" }),
  });

  function handleToggleEndorsement(code: CdlEndorsement) {
    setEndorsements((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function handleToggleRestriction(code: CdlRestriction) {
    setRestrictions((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function handleSave() {
    const years = yearsExperience !== "" ? parseInt(yearsExperience, 10) : null;
    if (years !== null && (isNaN(years) || years < 0 || years > 50)) {
      toast({ title: "Invalid input", description: "Years of experience must be 0–50.", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      cdlClass: cdlClass === "none" ? null : cdlClass,
      cdlState: cdlState === "none" ? null : cdlState,
      cdlEndorsements: Array.from(endorsements),
      cdlRestrictions: Array.from(restrictions),
      cdlExpiresAt: expiresAt || null,
      yearsExperience: years,
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-primary" size={28} />
          <div>
            <h1 className="text-2xl font-bold">CDL Cert Profile</h1>
            <p className="text-sm text-muted-foreground">
              Your credentials are matched against job requirements automatically.{" "}
              <Link href="/resources" className="underline underline-offset-2 hover:text-foreground transition-colors">
                Learn about CDL classes and endorsements →
              </Link>
            </p>
          </div>
          {profile?.updatedAt && (
            <Badge variant="outline" className="ml-auto gap-1">
              <CheckCircle2 size={12} />
              Saved {new Date(profile.updatedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading your profile…</p>
        ) : (
          <>
            {/* CDL Class + State */}
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base">License</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">CDL Class</label>
                  <Select value={cdlClass} onValueChange={(v) => setCdlClass(v as CdlClass | "none")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / No CDL</SelectItem>
                      {CDL_CLASSES.map((c) => (
                        <SelectItem key={c} value={c}>Class {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Issuing State</label>
                  <Select value={cdlState} onValueChange={setCdlState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Expiration Date</label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Years of Experience</label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    placeholder="e.g. 5"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {/* Endorsements */}
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base">Endorsements</h2>
              <p className="text-xs text-muted-foreground">Select all that appear on your CDL.</p>
              <div className="space-y-2">
                {CDL_ENDORSEMENTS.map((code) => (
                  <label key={code} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={endorsements.has(code)}
                      onCheckedChange={() => handleToggleEndorsement(code)}
                    />
                    <span className="text-sm">{ENDORSEMENT_LABELS[code]}</span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Restrictions */}
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold text-base">Restrictions</h2>
              <p className="text-xs text-muted-foreground">Select any restrictions listed on your CDL.</p>
              <div className="space-y-2">
                {CDL_RESTRICTIONS.map((code) => (
                  <label key={code} className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={restrictions.has(code)}
                      onCheckedChange={() => handleToggleRestriction(code)}
                    />
                    <span className="text-sm">{RESTRICTION_LABELS[code]}</span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Save */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                <Save size={16} />
                {saveMutation.isPending ? "Saving…" : "Save Cert Profile"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}