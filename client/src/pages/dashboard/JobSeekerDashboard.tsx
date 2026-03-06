import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, Briefcase, CreditCard, Plus, CheckCircle2, Clock, XCircle, AlertCircle, Eye, EyeOff, User } from "lucide-react";
import type { Application, Resume } from "@shared/schema";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  reviewed: { label: "Reviewed", icon: AlertCircle, color: "bg-blue-100 text-blue-700 border-blue-200" },
  accepted: { label: "Accepted", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700 border-red-200" },
};

function ApplicationsTab({ userId }: { userId: number }) {
  const { data: applications, isLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
  });

  const myApps = (applications || []).filter((a) => a.jobSeekerId === userId);

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">My Applications</h2>
        <Button asChild variant="outline" size="sm">
          <Link href="/jobs">Browse Jobs</Link>
        </Button>
      </div>
      {myApps.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display text-lg mb-2">No applications yet</h3>
          <p className="text-muted-foreground mb-4">Start applying to transportation jobs that match your skills.</p>
          <Button asChild><Link href="/jobs">Find Jobs</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {myApps.map((app) => {
            const status = statusConfig[app.status] || statusConfig.pending;
            const Icon = status.icon;
            return (
              <div key={app.id} data-testid={`card-application-${app.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Job Application #{app.jobId}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Applied {app.createdAt ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }) : "recently"}
                  </p>
                </div>
                <Badge className={`border ${status.color} flex items-center gap-1.5`}>
                  <Icon size={13} /> {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResumeTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resumeText, setResumeText] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: resumes, isLoading } = useQuery<Resume[]>({
    queryKey: ["/api/resumes", userId],
    queryFn: async () => {
      const res = await fetch(`/api/resumes/${userId}`);
      if (!res.ok) throw new Error("Failed to load resumes");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/resumes", { jobSeekerId: userId, content: resumeText, isUpload: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes", userId] });
      setResumeText("");
      setShowForm(false);
      toast({ title: "Resume saved!", description: "Your resume has been added to your profile." });
    },
    onError: () => toast({ title: "Error", description: "Could not save resume.", variant: "destructive" }),
  });

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">My Resumes</h2>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-resume">
          <Plus size={16} className="mr-2" /> Add Resume
        </Button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6 mb-6">
          <h3 className="font-bold font-display mb-3">Create Text Resume</h3>
          <Textarea
            data-testid="textarea-resume-content"
            placeholder="Paste or write your resume here..."
            className="min-h-[200px] mb-4"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!resumeText.trim() || createMutation.isPending}
              data-testid="button-save-resume"
            >
              {createMutation.isPending ? "Saving..." : "Save Resume"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {resumes && resumes.length > 0 ? (
        <div className="space-y-4">
          {resumes.map((resume) => (
            <div key={resume.id} data-testid={`card-resume-${resume.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">Resume #{resume.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resume.createdAt
                        ? formatDistanceToNow(new Date(resume.createdAt), { addSuffix: true })
                        : "Recently created"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{resume.content}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <FileText className="mx-auto mb-4 text-muted-foreground" size={40} />
            <h3 className="font-bold font-display text-lg mb-2">No resumes yet</h3>
            <p className="text-muted-foreground mb-4">Add your resume so employers can find you.</p>
            <Button onClick={() => setShowForm(true)}>Create Resume</Button>
          </div>
        )
      )}
    </div>
  );
}

type EntitlementData = {
  entitlementKey: string;
  type: "Limit" | "Flag";
  value: number;
  isUnlimited: boolean;
  enabled: boolean;
};

function formatEntitlementDisplay(ent: EntitlementData): string {
  if (ent.type === "Flag") return ent.enabled ? "Enabled" : "Disabled";
  if (ent.isUnlimited) return "Unlimited";
  return String(ent.value);
}

function formatEntitlementLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MembershipTab({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fulfilledRef = useRef(false);
  const { data: entitlementData } = useQuery<{ entitlements: Record<string, EntitlementData> }>({
    queryKey: ["/api/user/entitlements"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const isAddon = params.get("addon") === "true";
    if (sessionId && isAddon && !fulfilledRef.current) {
      fulfilledRef.current = true;
      apiRequest("POST", "/api/payments/fulfill-addon", { sessionId })
        .then((r) => r.json())
        .then((data) => {
          toast({ title: "Add-on activated!", description: data.message });
          queryClient.invalidateQueries({ queryKey: ["/api/user/entitlements"] });
          queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch(() => {
          toast({ title: "Fulfillment issue", description: "Your payment was received. Add-on may take a moment to activate.", variant: "destructive" });
        });
    }
  }, []);

  const entitlements = entitlementData?.entitlements ?? {};
  const entKeys = Object.keys(entitlements);

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">Membership</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <CreditCard size={28} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Current Plan</p>
            <h3 className="text-3xl font-bold font-display capitalize text-primary" data-testid="text-membership-tier">{user.membershipTier}</h3>
          </div>
        </div>

        {entKeys.length > 0 && (
          <div className="mb-8">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Your Entitlements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {entKeys.map((key) => {
                const ent = entitlements[key];
                return (
                  <div key={key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 border border-border" data-testid={`entitlement-${key}`}>
                    <span className="text-sm font-medium">{formatEntitlementLabel(key)}</span>
                    <Badge variant={ent.isUnlimited || ent.enabled ? "default" : "secondary"}>
                      {formatEntitlementDisplay(ent)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button asChild className="hover-elevate shadow-lg shadow-primary/20">
          <Link href="/pricing">Upgrade Plan</Link>
        </Button>
      </div>
    </div>
  );
}

function SeekerProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  const [showProfile, setShowProfile] = useState(user?.showProfile ?? true);
  const [showName, setShowName] = useState(user?.showName ?? true);
  const [showCurrentEmployer, setShowCurrentEmployer] = useState(user?.showCurrentEmployer ?? true);

  const saveMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; profileImage: string; showProfile: boolean; showName: boolean; showCurrentEmployer: boolean }) =>
      apiRequest("PATCH", "/api/profile", data).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.setQueryData(["/api/me"], data);
      toast({ title: "Profile updated!" });
    },
    onError: () => toast({ title: "Error", description: "Could not save profile.", variant: "destructive" }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">My Profile</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold mb-1 block">First Name</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" data-testid="input-first-name" />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1 block">Last Name</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" data-testid="input-last-name" />
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1 block">Profile Picture</Label>
          <p className="text-xs text-muted-foreground mb-2">Upload a profile photo or paste an image URL.</p>
          <ImageUpload
            value={profileImage}
            onChange={setProfileImage}
            placeholder="Upload or paste image URL"
            previewHeight="h-32"
            data-testid="image-profile-pic"
          />
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center gap-2 mb-4">
            {showProfile ? <Eye size={18} className="text-primary" /> : <EyeOff size={18} className="text-muted-foreground" />}
            <h3 className="text-lg font-bold font-display">Privacy Settings</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Choose what employers and other users can see on your public profile.</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border">
              <div>
                <Label className="text-sm font-semibold">Show Profile</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Allow your profile to be visible to employers</p>
              </div>
              <Switch
                checked={showProfile}
                onCheckedChange={setShowProfile}
                data-testid="switch-show-profile"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border">
              <div>
                <Label className="text-sm font-semibold">Show Name</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Display your full name on your profile</p>
              </div>
              <Switch
                checked={showName}
                onCheckedChange={setShowName}
                data-testid="switch-show-name"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border">
              <div>
                <Label className="text-sm font-semibold">Show Current Employer</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Display your current company on your profile</p>
              </div>
              <Switch
                checked={showCurrentEmployer}
                onCheckedChange={setShowCurrentEmployer}
                data-testid="switch-show-current-employer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-profile">
                <Eye size={16} className="mr-2" /> View Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Public Profile Preview</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground mb-4">This is how employers and other users see your profile.</p>
              {!showProfile ? (
                <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-border">
                  <EyeOff className="mx-auto mb-3 text-muted-foreground" size={32} />
                  <p className="font-semibold text-sm">Profile Hidden</p>
                  <p className="text-xs text-muted-foreground mt-1">Your profile is not visible to others.</p>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-16 w-16 border-2 border-border">
                      <AvatarImage src={profileImage} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {showName && firstName ? firstName[0]?.toUpperCase() : <User size={24} />}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      {showName ? (
                        <h3 className="font-bold font-display text-lg" data-testid="text-preview-name">
                          {firstName || lastName ? `${firstName} ${lastName}`.trim() : "No name set"}
                        </h3>
                      ) : (
                        <h3 className="font-bold font-display text-lg text-muted-foreground italic" data-testid="text-preview-name">
                          Anonymous Job Seeker
                        </h3>
                      )}
                    </div>
                  </div>
                  {showCurrentEmployer ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-preview-employer">
                      <Briefcase size={14} />
                      <span>{user?.companyName || "No current employer listed"}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground italic" data-testid="text-preview-employer">
                      <Briefcase size={14} />
                      <span>Current employer hidden</span>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => saveMutation.mutate({ firstName, lastName, profileImage, showProfile, showName, showCurrentEmployer })}
            disabled={saveMutation.isPending}
            data-testid="button-save-profile"
          >
            {saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function JobSeekerDashboard({ section }: { section?: string }) {
  const { user } = useAuth();

  if (!user) return null;

  const content = () => {
    if (section === "resume") return <ResumeTab userId={user.id} />;
    if (section === "profile") return <SeekerProfileTab />;
    if (section === "membership") return <MembershipTab user={user} />;
    return <ApplicationsTab userId={user.id} />;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {content()}
      </div>
    </DashboardLayout>
  );
}
