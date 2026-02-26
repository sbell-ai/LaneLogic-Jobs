import { useState } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Plus, Trash2, Users, Upload, CreditCard, CheckCircle2, MapPin, Eye, Building2, Phone, Mail, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import type { Job, Application, Category } from "@shared/schema";
import { insertJobSchema } from "@shared/schema";
import { z } from "zod";
import { Link } from "wouter";

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Seasonal", "Owner-Operator", "Lease Purchase", "Temporary"];

function fmtLoc(job: Job) {
  return [job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ");
}

const jobFormSchema = insertJobSchema.omit({ employerId: true }).extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  requirements: z.string().min(10, "Requirements must be at least 10 characters"),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

function PostJobTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const jobCategories = (categories || []).filter((c) => c.type === "job");
  const industries = (categories || []).filter((c) => c.type === "industry");

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "", companyName: "", jobType: "Full-time",
      description: "", requirements: "", benefits: "",
      locationCity: "", locationState: "", locationCountry: "USA",
      salary: "", applyUrl: "", isExternalApply: false,
      category: "", industry: "", expiresAt: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: JobFormValues) => {
      const payload = { ...values, employerId: userId, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null };
      return apiRequest("POST", "/api/jobs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      form.reset();
      toast({ title: "Job posted!", description: "Your job listing is now live." });
    },
    onError: () => toast({ title: "Error", description: "Could not post job.", variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold font-display mb-6">Post a New Job</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-5">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title *</FormLabel>
                <FormControl><Input placeholder="e.g. CDL Class A Driver" data-testid="input-job-title" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input placeholder="Acme Trucking" data-testid="input-company-name" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="jobType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? "Full-time"}>
                    <FormControl><SelectTrigger data-testid="select-job-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="locationCity" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input placeholder="Chicago" data-testid="input-location-city" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="locationState" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input placeholder="IL" data-testid="input-location-state" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="locationCountry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input placeholder="USA" data-testid="input-location-country" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger data-testid="select-job-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {jobCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger data-testid="select-job-industry"><SelectValue placeholder="Select industry" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {industries.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="salary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary (optional)</FormLabel>
                  <FormControl><Input placeholder="$70,000 – $90,000/yr" data-testid="input-job-salary" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="expiresAt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiration Date (optional)</FormLabel>
                  <FormControl><Input type="date" data-testid="input-job-expires" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description *</FormLabel>
                <FormControl><Textarea placeholder="Describe the role, responsibilities, and company culture..." className="min-h-[120px]" data-testid="textarea-job-description" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="requirements" render={({ field }) => (
              <FormItem>
                <FormLabel>Requirements *</FormLabel>
                <FormControl><Textarea placeholder="CDL Class A required, 3+ years experience..." className="min-h-[100px]" data-testid="textarea-job-requirements" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="benefits" render={({ field }) => (
              <FormItem>
                <FormLabel>Benefits (optional)</FormLabel>
                <FormControl><Textarea placeholder="Health insurance, 401k, paid time off, sign-on bonus..." className="min-h-[80px]" data-testid="textarea-job-benefits" {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="isExternalApply" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-external-apply" />
                </FormControl>
                <FormLabel className="cursor-pointer">Link to external application URL</FormLabel>
              </FormItem>
            )} />

            {form.watch("isExternalApply") && (
              <FormField control={form.control} name="applyUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>External Application URL</FormLabel>
                  <FormControl><Input placeholder="https://yourcompany.com/apply" data-testid="input-apply-url" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            )}

            <Button type="submit" disabled={createMutation.isPending} className="w-full hover-elevate" data-testid="button-post-job">
              {createMutation.isPending ? "Posting..." : "Post Job Listing"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

function MyJobsTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: jobs, isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: applications } = useQuery<Application[]>({ queryKey: ["/api/applications"] });

  const myJobs = (jobs || []).filter((j) => j.employerId === userId);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted", description: "The job listing has been removed." });
    },
  });

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">My Job Postings ({myJobs.length})</h2>
      </div>
      {myJobs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display text-lg mb-2">No jobs posted yet</h3>
          <p className="text-muted-foreground">Post your first job listing to start receiving applications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myJobs.map((job) => {
            const appCount = (applications || []).filter((a) => a.jobId === job.id).length;
            return (
              <div key={job.id} data-testid={`card-my-job-${job.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold font-display text-lg mb-1">{job.title}</h3>
                    <p className="text-sm text-muted-foreground">{fmtLoc(job)}{job.salary ? ` · ${job.salary}` : ""}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-xs">
                        <Users size={12} className="mr-1" /> {appCount} applicant{appCount !== 1 ? "s" : ""}
                      </Badge>
                      {job.isExternalApply && <Badge variant="outline" className="text-xs">External</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => deleteMutation.mutate(job.id)}
                    data-testid={`button-delete-job-${job.id}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ApplicantsTab({ userId }: { userId: number }) {
  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: applications, isLoading } = useQuery<Application[]>({ queryKey: ["/api/applications"] });

  const myJobIds = new Set((jobs || []).filter((j) => j.employerId === userId).map((j) => j.id));
  const myApps = (applications || []).filter((a) => myJobIds.has(a.jobId));

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">Applicants ({myApps.length})</h2>
      {myApps.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <Users className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display text-lg mb-2">No applicants yet</h3>
          <p className="text-muted-foreground">Applications will appear here when candidates apply to your jobs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myApps.map((app) => (
            <div key={app.id} data-testid={`card-applicant-${app.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Applicant #{app.jobSeekerId}</p>
                <p className="text-sm text-muted-foreground">For Job #{app.jobId}</p>
              </div>
              <Badge className={`capitalize border ${
                app.status === "accepted" ? "bg-green-100 text-green-700 border-green-200" :
                app.status === "rejected" ? "bg-red-100 text-red-700 border-red-200" :
                app.status === "reviewed" ? "bg-blue-100 text-blue-700 border-blue-200" :
                "bg-yellow-100 text-yellow-700 border-yellow-200"
              }`}>
                {app.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CsvUploadTab() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ message: string; count: number } | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/csv", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      setResult(data);
      toast({ title: "Upload successful!", description: data.message });
    } catch {
      toast({ title: "Error", description: "Could not upload CSV.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold font-display mb-6">Bulk CSV Upload</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8">
        <div className="text-center py-8 border-2 border-dashed border-border rounded-xl mb-6">
          <Upload className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display mb-2">Upload a CSV File</h3>
          <p className="text-muted-foreground text-sm mb-4">Upload a CSV file to bulk-add jobs, candidates, or employer profiles.</p>
          <Label htmlFor="csv-upload" className="cursor-pointer">
            <Button asChild variant="outline" disabled={uploading}>
              <span data-testid="button-upload-csv">{uploading ? "Uploading..." : "Choose CSV File"}</span>
            </Button>
          </Label>
          <Input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleUpload}
            data-testid="input-csv-file"
          />
        </div>
        {result && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle2 className="text-green-600 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-sm text-green-800 dark:text-green-400">{result.message}</p>
              <p className="text-xs text-green-600">{result.count} records processed</p>
            </div>
          </div>
        )}
        <div className="mt-6 text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">CSV Format Guide:</p>
          <p>• Jobs: title, description, requirements, location, salary, applyUrl</p>
          <p>• Candidates: firstName, lastName, email, skills, location</p>
          <p>• Employers: companyName, email, location, industry</p>
        </div>
      </div>
    </div>
  );
}

function EmployerMembershipTab({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const tierDetails: Record<string, { color: string; perks: string[] }> = {
    free: { color: "text-slate-500", perks: ["2 job postings/month", "View applications", "Basic employer profile"] },
    basic: { color: "text-primary", perks: ["10 job postings/month", "Featured listings", "CSV bulk upload", "Applicant filtering"] },
    premium: { color: "text-accent", perks: ["Unlimited job postings", "Priority placement", "Advanced analytics", "Candidate search", "Dedicated manager"] },
  };
  const details = tierDetails[user.membershipTier] || tierDetails.free;

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
            <h3 className={`text-3xl font-bold font-display capitalize ${details.color}`}>{user.membershipTier}</h3>
          </div>
        </div>
        <ul className="space-y-2 mb-8">
          {details.perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={15} className="text-primary shrink-0" />
              <span className="text-muted-foreground">{perk}</span>
            </li>
          ))}
        </ul>
        {user.membershipTier !== "premium" && (
          <Button asChild className="hover-elevate shadow-lg shadow-primary/20">
            <Link href="/pricing?tab=employer">Upgrade Plan</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function CompanyProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState(user?.companyName || "");
  const [companyAddress, setCompanyAddress] = useState(user?.companyAddress || "");
  const [contactName, setContactName] = useState(user?.contactName || "");
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || "");
  const [contactPhone, setContactPhone] = useState(user?.contactPhone || "");
  const [aboutCompany, setAboutCompany] = useState(user?.aboutCompany || "");
  const [logo, setLogo] = useState(user?.companyLogo || "");

  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const myJobs = (jobs || []).filter((j) => j.employerId === user?.id);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("PATCH", "/api/profile", data).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.setQueryData(["/api/me"], data);
      toast({ title: "Company profile updated!" });
    },
    onError: () => toast({ title: "Error", description: "Could not save profile.", variant: "destructive" }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">Company Profile</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 space-y-5">
        <div>
          <Label className="text-sm font-semibold mb-1 block">Company Name</Label>
          <Input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Your company name"
            data-testid="input-company-name"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1 block">Company Address</Label>
          <Input
            value={companyAddress}
            onChange={e => setCompanyAddress(e.target.value)}
            placeholder="123 Main St, City, State ZIP"
            data-testid="input-company-address"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-semibold mb-1 block">Contact Name</Label>
            <Input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Full name of primary contact"
              data-testid="input-contact-name"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1 block">Contact Email Address</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="contact@company.com"
              data-testid="input-contact-email"
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1 block">Contact Phone Number</Label>
          <Input
            type="tel"
            value={contactPhone}
            onChange={e => setContactPhone(e.target.value)}
            placeholder="(555) 123-4567"
            data-testid="input-contact-phone"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1 block">About Company</Label>
          <Textarea
            value={aboutCompany}
            onChange={e => setAboutCompany(e.target.value)}
            placeholder="Tell job seekers about your company, mission, and culture..."
            rows={4}
            data-testid="input-about-company"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold mb-1 block">Company Logo</Label>
          <p className="text-xs text-muted-foreground mb-2">Upload your company logo or paste an image URL.</p>
          <ImageUpload
            value={logo}
            onChange={setLogo}
            placeholder="Upload or paste logo URL"
            previewHeight="h-24"
            data-testid="image-company-logo"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-employer-profile">
                <Eye size={16} className="mr-2" /> View Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Public Company Profile Preview</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground mb-4">This is how job seekers see your company on the platform.</p>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border p-6">
                <div className="flex items-center gap-4 mb-5">
                  <Avatar className="h-16 w-16 border-2 border-border rounded-xl">
                    <AvatarImage src={logo} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg rounded-xl">
                      {companyName ? companyName[0]?.toUpperCase() : <Building2 size={24} />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold font-display text-lg" data-testid="text-preview-company-name">
                      {companyName || "No company name set"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle2 size={14} className="text-primary" />
                      <span className="text-xs text-muted-foreground">Verified Employer</span>
                    </div>
                  </div>
                </div>
                {(companyAddress || contactName || contactEmail || contactPhone) && (
                  <div className="border-t border-border pt-4 mb-4 space-y-2">
                    {companyAddress && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} />
                        <span data-testid="text-preview-company-address">{companyAddress}</span>
                      </div>
                    )}
                    {contactName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User size={14} />
                        <span data-testid="text-preview-contact-name">{contactName}</span>
                      </div>
                    )}
                    {contactEmail && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail size={14} />
                        <span data-testid="text-preview-contact-email">{contactEmail}</span>
                      </div>
                    )}
                    {contactPhone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone size={14} />
                        <span data-testid="text-preview-contact-phone">{contactPhone}</span>
                      </div>
                    )}
                  </div>
                )}
                {aboutCompany && (
                  <div className="border-t border-border pt-4 mb-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-preview-about-company">{aboutCompany}</p>
                  </div>
                )}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Briefcase size={14} />
                    <span data-testid="text-preview-job-count">{myJobs.length} active job{myJobs.length !== 1 ? "s" : ""} posted</span>
                  </div>
                  {myJobs.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {myJobs.slice(0, 3).map((job) => (
                        <div key={job.id} className="text-sm bg-white dark:bg-slate-900 rounded-lg border border-border px-3 py-2">
                          <p className="font-medium">{job.title}</p>
                          {(job.locationCity || job.locationState) && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin size={10} /> {fmtLoc(job)}
                            </p>
                          )}
                        </div>
                      ))}
                      {myJobs.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{myJobs.length - 3} more listing{myJobs.length - 3 !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={() => saveMutation.mutate({ companyName, companyAddress, contactName, contactEmail, contactPhone, aboutCompany, companyLogo: logo })}
            disabled={saveMutation.isPending}
            data-testid="button-save-company-profile"
          >
            {saveMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EmployerDashboard({ section }: { section?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const content = () => {
    if (section === "jobs") return <MyJobsTab userId={user.id} />;
    if (section === "applicants") return <ApplicantsTab userId={user.id} />;
    if (section === "upload") return <CsvUploadTab />;
    if (section === "profile") return <CompanyProfileTab />;
    if (section === "membership") return <EmployerMembershipTab user={user} />;
    return <PostJobTab userId={user.id} />;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {content()}
      </div>
    </DashboardLayout>
  );
}
