import { useState, useEffect, useRef } from "react";
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
import { Briefcase, Plus, Trash2, Users, Upload, CreditCard, CheckCircle2, MapPin, Eye, Building2, Phone, Mail, User, MessageSquare, Pencil, ExternalLink, ChevronDown, ChevronRight, StickyNote, Check, Save, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import type { Job, Application, Category } from "@shared/schema";
import { insertJobSchema } from "@shared/schema";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { validateCategoryPair } from "@shared/jobTaxonomy";
import { useTaxonomy } from "@/hooks/use-taxonomy";

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Seasonal", "Owner-Operator", "Lease Purchase", "OTR", "Temporary", "Other"];

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
  const industries = (categories || []).filter((c) => c.type === "industry");
  const { categories: taxonomyCats, getSubcategories } = useTaxonomy();

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "", companyName: "", jobType: "Full-time",
      description: "", requirements: "", benefits: "",
      locationCity: "", locationState: "", locationCountry: "USA",
      salary: "", applyUrl: "", isExternalApply: false,
      category: "", subcategory: "", industry: "", expiresAt: "",
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
          <form onSubmit={form.handleSubmit((v) => {
            const pairCheck = validateCategoryPair(v.category || null, v.subcategory || null);
            if (!pairCheck.valid) { toast({ title: "Validation Error", description: pairCheck.error, variant: "destructive" }); return; }
            createMutation.mutate(v);
          })} className="space-y-5">
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
                  <Select onValueChange={(v) => { field.onChange(v === "__none__" ? "" : v); form.setValue("subcategory", ""); }} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger data-testid="select-job-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {taxonomyCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="subcategory" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"} disabled={!form.watch("category")}>
                    <FormControl><SelectTrigger data-testid="select-job-subcategory"><SelectValue placeholder="Select subcategory" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {form.watch("category") && getSubcategories(form.watch("category")).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
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

function EditJobDialog({ job }: { job: Job }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data: categories } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const industries = (categories || []).filter((c) => c.type === "industry");
  const { categories: taxonomyCats, getSubcategories } = useTaxonomy();

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: job.title,
      companyName: job.companyName || "",
      jobType: job.jobType || "Full-time",
      description: job.description,
      requirements: job.requirements,
      benefits: job.benefits || "",
      locationCity: job.locationCity || "",
      locationState: job.locationState || "",
      locationCountry: job.locationCountry || "USA",
      salary: job.salary || "",
      applyUrl: job.applyUrl || "",
      isExternalApply: job.isExternalApply || false,
      category: job.category || "",
      subcategory: job.subcategory || "",
      industry: job.industry || "",
      expiresAt: job.expiresAt ? new Date(job.expiresAt).toISOString().split("T")[0] : "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: job.title,
        companyName: job.companyName || "",
        jobType: job.jobType || "Full-time",
        description: job.description,
        requirements: job.requirements,
        benefits: job.benefits || "",
        locationCity: job.locationCity || "",
        locationState: job.locationState || "",
        locationCountry: job.locationCountry || "USA",
        salary: job.salary || "",
        applyUrl: job.applyUrl || "",
        isExternalApply: job.isExternalApply || false,
        category: job.category || "",
        subcategory: job.subcategory || "",
        industry: job.industry || "",
        expiresAt: job.expiresAt ? new Date(job.expiresAt).toISOString().split("T")[0] : "",
      });
    }
  }, [open]);

  const editMutation = useMutation({
    mutationFn: (values: JobFormValues) => {
      const payload = { ...values, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null };
      return apiRequest("PUT", `/api/jobs/${job.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated!", description: "Your changes have been saved." });
      setOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Could not update job.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-edit-job-${job.id}`} title="Edit listing">
          <Pencil size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job Listing</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => {
            const pairCheck = validateCategoryPair(v.category || null, v.subcategory || null);
            if (!pairCheck.valid) { toast({ title: "Validation Error", description: pairCheck.error, variant: "destructive" }); return; }
            editMutation.mutate(v);
          })} className="space-y-5">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title *</FormLabel>
                <FormControl><Input placeholder="e.g. CDL Class A Driver" data-testid="input-edit-job-title" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input placeholder="Acme Trucking" data-testid="input-edit-company-name" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="jobType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "Full-time"}>
                    <FormControl><SelectTrigger data-testid="select-edit-job-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="locationCity" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input placeholder="Chicago" data-testid="input-edit-location-city" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="locationState" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input placeholder="IL" data-testid="input-edit-location-state" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="locationCountry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl><Input placeholder="USA" data-testid="input-edit-location-country" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v === "__none__" ? "" : v); form.setValue("subcategory", ""); }} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger data-testid="select-edit-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {taxonomyCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="subcategory" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"} disabled={!form.watch("category")}>
                    <FormControl><SelectTrigger data-testid="select-edit-subcategory"><SelectValue placeholder="Select subcategory" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {form.watch("category") && getSubcategories(form.watch("category")).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                    <FormControl><SelectTrigger data-testid="select-edit-industry"><SelectValue placeholder="Select industry" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {industries.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="salary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary (optional)</FormLabel>
                  <FormControl><Input placeholder="$70,000 – $90,000/yr" data-testid="input-edit-salary" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="expiresAt" render={({ field }) => (
              <FormItem>
                <FormLabel>Expiration Date (optional)</FormLabel>
                <FormControl><Input type="date" data-testid="input-edit-expires" {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description *</FormLabel>
                <FormControl><Textarea placeholder="Describe the role, responsibilities, and company culture..." className="min-h-[120px]" data-testid="textarea-edit-description" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="requirements" render={({ field }) => (
              <FormItem>
                <FormLabel>Requirements *</FormLabel>
                <FormControl><Textarea placeholder="CDL Class A required, 3+ years experience..." className="min-h-[100px]" data-testid="textarea-edit-requirements" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="benefits" render={({ field }) => (
              <FormItem>
                <FormLabel>Benefits (optional)</FormLabel>
                <FormControl><Textarea placeholder="Health insurance, 401k, paid time off..." className="min-h-[80px]" data-testid="textarea-edit-benefits" {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="isExternalApply" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-edit-external-apply" />
                </FormControl>
                <FormLabel className="cursor-pointer">Link to external application URL</FormLabel>
              </FormItem>
            )} />
            {form.watch("isExternalApply") && (
              <FormField control={form.control} name="applyUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>External Application URL</FormLabel>
                  <FormControl><Input placeholder="https://yourcompany.com/apply" data-testid="input-edit-apply-url" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            )}
            <Button type="submit" disabled={editMutation.isPending} className="w-full" data-testid="button-save-job-edit">
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold font-display text-lg mb-1">{job.title}</h3>
                    <p className="text-sm text-muted-foreground">{fmtLoc(job)}{job.salary ? ` · ${job.salary}` : ""}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-xs">
                        <Users size={12} className="mr-1" /> {appCount} applicant{appCount !== 1 ? "s" : ""}
                      </Badge>
                      {job.isExternalApply && <Badge variant="outline" className="text-xs">External</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/jobs/${job.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-view-job-${job.id}`}
                      title="View listing"
                    >
                      <Button variant="ghost" size="icon" asChild>
                        <span><ExternalLink size={16} /></span>
                      </Button>
                    </a>
                    <EditJobDialog job={job} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(job.id)}
                      data-testid={`button-delete-job-${job.id}`}
                      title="Delete listing"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type EnrichedApplication = Application & { seekerName: string; seekerEmail: string; employerNotes?: string | null };

const PIPELINE_STATUSES = [
  { value: "new",         label: "New Application", color: "bg-yellow-100 text-yellow-700 border-yellow-200 ring-yellow-400" },
  { value: "shortlisted", label: "Shortlisted",     color: "bg-blue-100 text-blue-700 border-blue-200 ring-blue-400" },
] as const;

const DECISION_STATUSES = [
  { value: "hired",      label: "Hired",       color: "bg-green-100 text-green-700 border-green-200 ring-green-400" },
  { value: "on_hold",    label: "On Hold",     color: "bg-orange-100 text-orange-700 border-orange-200 ring-orange-400" },
  { value: "not_a_fit",  label: "Not a Fit",   color: "bg-red-100 text-red-700 border-red-200 ring-red-400" },
] as const;

const ALL_STATUSES = [...PIPELINE_STATUSES, ...DECISION_STATUSES];

function normalizeStatus(status: string): string {
  const legacyMap: Record<string, string> = { pending: "new", reviewed: "shortlisted", accepted: "hired", rejected: "not_a_fit" };
  return legacyMap[status] ?? status;
}

function statusMeta(status: string) {
  const norm = normalizeStatus(status);
  return ALL_STATUSES.find((s) => s.value === norm) ?? PIPELINE_STATUSES[0];
}

function appGroup(status: string): "active" | "hired" | "on_hold" | "not_a_fit" {
  const norm = normalizeStatus(status);
  if (norm === "hired") return "hired";
  if (norm === "on_hold") return "on_hold";
  if (norm === "not_a_fit") return "not_a_fit";
  return "active";
}

function ApplicantNotes({ app, onSaved }: { app: EnrichedApplication; onSaved: (notes: string) => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(app.employerNotes ?? "");
  const saved = app.employerNotes ?? "";
  const isDirty = draft !== saved;

  const noteMutation = useMutation({
    mutationFn: (notes: string) =>
      apiRequest("PUT", `/api/applications/${app.id}`, { employerNotes: notes }).then((r) => r.json()),
    onSuccess: (updated: any) => {
      onSaved(updated.employerNotes ?? "");
      toast({ title: "Note saved" });
    },
    onError: () => toast({ title: "Error", description: "Could not save note.", variant: "destructive" }),
  });

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <StickyNote size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Private Notes</span>
        {isDirty && <span className="text-xs text-orange-500 ml-1">● unsaved</span>}
      </div>
      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add private notes about this candidate — only you can see these…"
          rows={2}
          data-testid={`textarea-notes-${app.id}`}
          className="flex-1 text-sm rounded-lg border border-border bg-slate-50 dark:bg-slate-800 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
        />
        <Button
          size="sm"
          variant={isDirty ? "default" : "ghost"}
          disabled={!isDirty || noteMutation.isPending}
          onClick={() => noteMutation.mutate(draft)}
          data-testid={`button-save-notes-${app.id}`}
          className="self-end gap-1.5 shrink-0"
        >
          {noteMutation.isPending ? <Check size={14} /> : <Save size={14} />}
          {noteMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

const GROUP_CONFIG = [
  {
    key: "active" as const,
    label: "Active Pipeline",
    icon: Users,
    defaultOpen: true,
    headerColor: "text-foreground",
    emptyText: "No active candidates. Move applicants here by setting them to New Application or Shortlisted.",
  },
  {
    key: "hired" as const,
    label: "Hired",
    icon: CheckCircle2,
    defaultOpen: true,
    headerColor: "text-green-600",
    emptyText: null,
  },
  {
    key: "on_hold" as const,
    label: "On Hold",
    icon: Eye,
    defaultOpen: true,
    headerColor: "text-orange-600",
    emptyText: null,
  },
  {
    key: "not_a_fit" as const,
    label: "Not a Fit",
    icon: Trash2,
    defaultOpen: false,
    headerColor: "text-red-500",
    emptyText: null,
  },
];

function ApplicantsTab({ userId }: { userId: number }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: myApps = [], isLoading } = useQuery<EnrichedApplication[]>({
    queryKey: ["/api/employer/applicants"],
  });

  const [messagingAppId, setMessagingAppId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUP_CONFIG.map((g) => [g.key, g.defaultOpen]))
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/applications/${id}`, { status }).then((r) => r.json()),
    onSuccess: (updated: any) => {
      setUpdatingStatusId(null);
      queryClient.setQueryData<EnrichedApplication[]>(["/api/employer/applicants"], (prev) =>
        (prev || []).map((a) => (a.id === updated.id ? { ...a, status: updated.status } : a))
      );
      const label = statusMeta(updated.status).label;
      toast({ title: "Status updated", description: `Candidate moved to ${label}.` });
    },
    onError: () => {
      setUpdatingStatusId(null);
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    },
  });

  const messageMutation = useMutation({
    mutationFn: (app: EnrichedApplication) =>
      apiRequest("POST", "/api/conversations", {
        seekerId: app.jobSeekerId,
        employerId: userId,
        jobId: app.jobId,
      }).then((r) => r.json()),
    onSuccess: (conv: any) => {
      setMessagingAppId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setLocation(`/dashboard/messages?conv=${conv.id}`);
    },
    onError: () => {
      setMessagingAppId(null);
      toast({ title: "Error", description: "Could not open conversation.", variant: "destructive" });
    },
  });

  const jobMap = new Map((jobs || []).map((j) => [j.id, j]));

  if (isLoading) return <div className="animate-pulse h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  if (myApps.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold font-display mb-6">Applicants</h2>
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <Users className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="font-bold font-display text-lg mb-2">No applicants yet</h3>
          <p className="text-muted-foreground">Applications will appear here when candidates apply to your jobs.</p>
        </div>
      </div>
    );
  }

  const grouped = Object.fromEntries(GROUP_CONFIG.map((g) => [g.key, [] as EnrichedApplication[]])) as Record<string, EnrichedApplication[]>;
  myApps.forEach((app) => grouped[appGroup(app.status)].push(app));

  const renderCard = (app: EnrichedApplication) => {
    const job = jobMap.get(app.jobId);
    const norm = normalizeStatus(app.status);
    const isUpdating = updatingStatusId === app.id;
    const isMessaging = messagingAppId === app.id;

    return (
      <div key={app.id} data-testid={`card-applicant-${app.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" data-testid={`text-seeker-name-${app.id}`}>{app.seekerName}</p>
            {app.seekerEmail && app.seekerEmail !== app.seekerName && (
              <p className="text-xs text-muted-foreground truncate">{app.seekerEmail}</p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{job ? job.title : `Job #${app.jobId}`}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            data-testid={`button-message-applicant-${app.id}`}
            disabled={isMessaging}
            onClick={() => { setMessagingAppId(app.id); messageMutation.mutate(app); }}
          >
            <MessageSquare size={14} />
            {isMessaging ? "Opening…" : "Message"}
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1 shrink-0">Pipeline</span>
            {PIPELINE_STATUSES.map((s) => (
              <button
                key={s.value}
                data-testid={`status-option-${s.value}-${app.id}`}
                disabled={isUpdating}
                onClick={() => {
                  if (norm === s.value) return;
                  setUpdatingStatusId(app.id);
                  statusMutation.mutate({ id: app.id, status: s.value });
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                  ${norm === s.value
                    ? `${s.color} ring-2 ring-offset-1 cursor-default`
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 cursor-pointer"}
                  ${isUpdating ? "opacity-50 pointer-events-none" : ""}`}
              >
                {s.label}
              </button>
            ))}
            <span className="text-muted-foreground/30 text-xs mx-1">│</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1 shrink-0">Decision</span>
            {DECISION_STATUSES.map((s) => (
              <button
                key={s.value}
                data-testid={`status-option-${s.value}-${app.id}`}
                disabled={isUpdating}
                onClick={() => {
                  if (norm === s.value) return;
                  setUpdatingStatusId(app.id);
                  statusMutation.mutate({ id: app.id, status: s.value });
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                  ${norm === s.value
                    ? `${s.color} ring-2 ring-offset-1 cursor-default`
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 cursor-pointer"}
                  ${isUpdating ? "opacity-50 pointer-events-none" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <ApplicantNotes
          app={app}
          onSaved={(notes) => {
            queryClient.setQueryData<EnrichedApplication[]>(["/api/employer/applicants"], (prev) =>
              (prev || []).map((a) => (a.id === app.id ? { ...a, employerNotes: notes } : a))
            );
          }}
        />
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">Applicants ({myApps.length})</h2>
      <div className="space-y-6">
        {GROUP_CONFIG.map((group) => {
          const cards = grouped[group.key] || [];
          if (cards.length === 0 && !group.emptyText) return null;
          const isOpen = openGroups[group.key];
          const Icon = group.icon;
          return (
            <div key={group.key} data-testid={`group-${group.key}`}>
              <button
                className="w-full flex items-center gap-2 mb-3 group"
                onClick={() => setOpenGroups((p) => ({ ...p, [group.key]: !p[group.key] }))}
                data-testid={`group-toggle-${group.key}`}
              >
                <Icon size={16} className={group.headerColor} />
                <span className={`font-bold font-display ${group.headerColor}`}>{group.label}</span>
                <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal">{cards.length}</Badge>
                <div className="flex-1 h-px bg-border mx-2" />
                {isOpen ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronRight size={15} className="text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="space-y-4">
                  {cards.length === 0 && group.emptyText ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{group.emptyText}</p>
                  ) : (
                    cards.map(renderCard)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
              <span data-testid="button-upload-csv" className="inline-flex items-center gap-1.5">{uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : "Choose CSV File"}</span>
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

type EntitlementData = {
  entitlementKey: string;
  type: "Limit" | "Flag";
  value: number;
  isUnlimited: boolean;
  enabled: boolean;
};

function formatEntitlementDisplay(key: string, ent: EntitlementData): string {
  if (ent.type === "Flag") {
    return ent.enabled ? "Enabled" : "Disabled";
  }
  if (ent.isUnlimited) return "Unlimited";
  return String(ent.value);
}

function formatEntitlementLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type PricingProduct = {
  name: string;
  audience: string;
  billingCycle: string;
  planType: string;
  price: number;
  trialDays: number;
  stripePriceId: string;
  logicKey: string;
  features: { key: string; name: string; value: number; isUnlimited: boolean; enabled: boolean; type: string }[];
};

function EmployerMembershipTab({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fulfilledRef = useRef(false);
  const { data: entitlementData } = useQuery<{ entitlements: Record<string, EntitlementData> }>({
    queryKey: ["/api/user/entitlements"],
  });
  const { data: pricingData } = useQuery<{ products: PricingProduct[] }>({
    queryKey: ["/api/registry/pricing"],
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

  const addOns = (pricingData?.products ?? []).filter(
    (p) => p.planType === "Top-up" && p.audience === "Employer" && p.stripePriceId
  );

  const purchaseAddon = async (addon: PricingProduct) => {
    try {
      const res = await apiRequest("POST", "/api/payments/create-checkout-session", {
        stripePriceId: addon.stripePriceId,
        planType: "Top-up",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not start checkout", variant: "destructive" });
    }
  };

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
                      {formatEntitlementDisplay(key, ent)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button asChild className="hover-elevate shadow-lg shadow-primary/20">
          <Link href="/pricing?tab=employer">Upgrade Plan</Link>
        </Button>
      </div>

      {addOns.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold font-display mb-6">Add-Ons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addOns.map((addon) => (
              <Card key={addon.stripePriceId} className="p-6">
                <h3 className="text-lg font-bold font-display mb-2" data-testid={`text-addon-name-${addon.stripePriceId}`}>{addon.name}</h3>
                <p className="text-2xl font-bold text-primary mb-3" data-testid={`text-addon-price-${addon.stripePriceId}`}>
                  ${Number.isInteger(addon.price) ? addon.price : addon.price.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">one-time</span>
                </p>
                {addon.features.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {addon.features.map((f) => (
                      <li key={f.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 size={14} className="text-primary shrink-0" />
                        {f.name}: {f.isUnlimited ? "Unlimited" : f.type === "Flag" ? (f.enabled ? "Yes" : "No") : f.value}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  onClick={() => purchaseAddon(addon)}
                  className="w-full hover-elevate"
                  data-testid={`button-purchase-addon-${addon.stripePriceId}`}
                >
                  Purchase
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
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
          {user?.id && (
            <Button variant="outline" asChild data-testid="link-view-public-profile">
              <Link href={`/employers/${user.id}`}>
                <Eye size={16} className="mr-2" /> View Public Page
              </Link>
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-view-employer-profile">
                <Eye size={16} className="mr-2" /> Preview
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
