import { useState } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Users, Briefcase, BookOpen, FileText, Plus, Trash2,
  Upload, CheckCircle2, Copy, Eye, EyeOff, UserPlus,
  AlertCircle, Download
} from "lucide-react";
import type { User, Job, Resource, BlogPost } from "@shared/schema";
import { insertResourceSchema, insertBlogPostSchema, insertJobSchema } from "@shared/schema";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";

// ─── USERS TAB ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiRequest("PUT", `/api/users/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({ id, membershipTier }: { id: number; membershipTier: string }) =>
      apiRequest("PUT", `/api/users/${id}`, { membershipTier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Membership tier updated" });
    },
  });

  const filtered = (users || []).filter(u =>
    !search ||
    `${u.email} ${u.firstName} ${u.lastName} ${u.companyName}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">All Users ({users?.length || 0})</h2>
        <Input
          placeholder="Search users..."
          className="w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-user-search"
        />
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Joined</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} data-testid={`row-user-${user.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium">{user.firstName} {user.lastName}{user.companyName && ` · ${user.companyName}`}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <Select
                      defaultValue={user.role}
                      onValueChange={(role) => updateRoleMutation.mutate({ id: user.id, role })}
                    >
                      <SelectTrigger className="h-8 w-36" data-testid={`select-role-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="job_seeker">Job Seeker</SelectItem>
                        <SelectItem value="employer">Employer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-5 py-4">
                    <Select
                      defaultValue={user.membershipTier}
                      onValueChange={(membershipTier) => updateTierMutation.mutate({ id: user.id, membershipTier })}
                    >
                      <SelectTrigger className="h-8 w-32" data-testid={`select-tier-${user.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No users found.</div>
        )}
      </div>
    </div>
  );
}

// ─── ALL JOBS TAB ─────────────────────────────────────────────────────────────

function AllJobsTab() {
  const { data: jobs, isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted" });
    },
  });

  const filtered = (jobs || []).filter(j =>
    !search || `${j.title} ${j.location}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">All Jobs ({jobs?.length || 0})</h2>
        <Input
          placeholder="Search jobs..."
          className="w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-jobs-search"
        />
      </div>
      <div className="space-y-3">
        {filtered.map((job) => (
          <div key={job.id} data-testid={`card-admin-job-${job.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{job.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {job.location}{job.salary ? ` · ${job.salary}` : ""}
                {job.isExternalApply && <span className="ml-2 text-xs text-primary">External</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {job.createdAt ? formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }) : ""}
              </p>
            </div>
            <Button
              variant="ghost" size="icon"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => deleteMutation.mutate(job.id)}
              data-testid={`button-admin-delete-job-${job.id}`}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">No jobs found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── POST JOB TAB (Admin) ─────────────────────────────────────────────────────

const jobFormSchema = insertJobSchema.omit({ employerId: true }).extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  requirements: z.string().min(10, "Requirements must be at least 10 characters"),
  location: z.string().min(2, "Location required"),
});

function PostJobTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "", description: "", requirements: "",
      location: "", salary: "", applyUrl: "", isExternalApply: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof jobFormSchema>) =>
      apiRequest("POST", "/api/jobs", { ...values, employerId: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      form.reset();
      toast({ title: "Job posted!", description: "The job listing is now live on the board." });
    },
    onError: () => toast({ title: "Error", description: "Could not post job.", variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold font-display mb-2">Post a Job</h2>
      <p className="text-muted-foreground mb-6">Create a job listing on behalf of an employer or directly from admin.</p>
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
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location *</FormLabel>
                  <FormControl><Input placeholder="Chicago, IL" data-testid="input-job-location" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="salary" render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary (optional)</FormLabel>
                  <FormControl><Input placeholder="$70,000 – $90,000" data-testid="input-job-salary" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description *</FormLabel>
                <FormControl><Textarea placeholder="Role overview, responsibilities, and benefits..." className="min-h-[130px]" data-testid="textarea-job-description" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="requirements" render={({ field }) => (
              <FormItem>
                <FormLabel>Requirements *</FormLabel>
                <FormControl><Textarea placeholder="CDL Class A, 3+ years experience, clean record..." className="min-h-[100px]" data-testid="textarea-job-requirements" {...field} /></FormControl>
                <FormMessage />
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
                  <FormControl><Input placeholder="https://company.com/apply" data-testid="input-apply-url" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            )}
            <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-post-job">
              {createMutation.isPending ? "Posting..." : "Post Job Listing"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

// ─── UPLOAD JOBS CSV TAB ──────────────────────────────────────────────────────

interface ParsedJob {
  title: string;
  location: string;
  description: string;
  requirements: string;
  salary?: string;
  applyUrl?: string;
}

function UploadJobsTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [parsed, setParsed] = useState<ParsedJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsed([]);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.trim().split("\n");
        if (lines.length < 2) {
          setError("CSV must have a header row and at least one data row.");
          setUploading(false);
          return;
        }
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
        const rows: ParsedJob[] = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(",").map(v => v.trim().replace(/"/g, ""));
          const row: any = {};
          headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
          if (!row.title || !row.location) continue;
          rows.push({
            title: row.title,
            location: row.location,
            description: row.description || "Please contact us for full job details.",
            requirements: row.requirements || "Please contact us for requirements.",
            salary: row.salary || undefined,
            applyUrl: row.applyurl || row.apply_url || undefined,
          });
        }
        if (rows.length === 0) {
          setError("No valid rows found. Ensure columns: title, location, description, requirements");
          setUploading(false);
          return;
        }
        setParsed(rows);
        setUploading(false);
      } catch {
        setError("Failed to parse CSV. Please check the file format.");
        setUploading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importAll = async () => {
    setImporting(true);
    let success = 0;
    for (const job of parsed) {
      try {
        await apiRequest("POST", "/api/jobs", {
          ...job,
          employerId: userId,
          isExternalApply: !!job.applyUrl,
        });
        success++;
      } catch { /* skip bad rows */ }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    setParsed([]);
    setImporting(false);
    toast({ title: `Imported ${success} of ${parsed.length} jobs!` });
  };

  const sampleCsv = `title,location,description,requirements,salary,applyUrl
CDL Class A Driver,Chicago IL,"Looking for an experienced long haul driver","CDL Class A required; 3+ years experience",$80000,
Fleet Dispatcher,Atlanta GA,"Manage driver schedules and routes","2+ years dispatching experience","$55,000–$65,000",https://example.com/apply`;

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transpojobs-sample.csv";
    a.click();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-2xl font-bold font-display">Upload Jobs via CSV</h2>
          <p className="text-muted-foreground mt-1">Import multiple job listings at once from a CSV file.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadSample} data-testid="button-download-sample">
          <Download size={15} className="mr-2" /> Sample CSV
        </Button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 mb-6">
        <p className="font-semibold mb-1">Required columns:</p>
        <code className="text-xs">title, location, description, requirements</code>
        <p className="mt-1">Optional: <code className="text-xs">salary, applyUrl</code></p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 mb-6">
        <div className="border-2 border-dashed border-border rounded-xl py-10 text-center mb-0">
          <Upload className="mx-auto mb-3 text-muted-foreground" size={36} />
          <p className="font-semibold mb-1">Drop your CSV file here or click to browse</p>
          <p className="text-sm text-muted-foreground mb-4">UTF-8 encoded .csv files only</p>
          <Label htmlFor="csv-jobs-upload" className="cursor-pointer">
            <Button asChild variant="outline" disabled={uploading}>
              <span data-testid="button-choose-csv">{uploading ? "Reading..." : "Choose CSV File"}</span>
            </Button>
          </Label>
          <Input id="csv-jobs-upload" type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="input-csv-upload" />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 mb-6">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {parsed.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="font-semibold">{parsed.length} job{parsed.length !== 1 ? "s" : ""} ready to import</p>
            <Button onClick={importAll} disabled={importing} data-testid="button-import-jobs">
              {importing ? "Importing..." : `Import All ${parsed.length} Jobs`}
            </Button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {parsed.map((job, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-lg border border-border p-4 text-sm">
                <p className="font-semibold">{job.title}</p>
                <p className="text-muted-foreground">{job.location}{job.salary ? ` · ${job.salary}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── INVITE USER TAB ──────────────────────────────────────────────────────────

function InviteUserTab({ targetRole }: { targetRole: "job_seeker" | "employer" }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ email: string; password: string } | null>(null);

  const isEmployer = targetRole === "employer";

  const schema = z.object({
    email: z.string().email("Valid email required"),
    password: z.string().min(8, "Minimum 8 characters"),
    firstName: isEmployer ? z.string().optional() : z.string().min(1, "First name required"),
    lastName: isEmployer ? z.string().optional() : z.string().min(1, "Last name required"),
    companyName: isEmployer ? z.string().min(1, "Company name required") : z.string().optional(),
    membershipTier: z.enum(["free", "basic", "premium"]),
  });

  type FormVals = z.infer<typeof schema>;

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "", password: "", firstName: "", lastName: "",
      companyName: "", membershipTier: "free",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormVals) =>
      apiRequest("POST", "/api/admin/users", { ...values, role: targetRole }).then(r => r.json()),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreatedUser({ email: variables.email, password: variables.password });
      form.reset();
      toast({ title: `${isEmployer ? "Employer" : "Job Seeker"} account created!` });
    },
    onError: async (err: any) => {
      const msg = err?.message || "Could not create account";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const copyCredentials = () => {
    if (!createdUser) return;
    navigator.clipboard.writeText(`Email: ${createdUser.email}\nPassword: ${createdUser.password}\nLogin at: ${window.location.origin}/login`);
    toast({ title: "Credentials copied to clipboard!" });
  };

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold font-display mb-2">
        Invite {isEmployer ? "Employer" : "Job Seeker"}
      </h2>
      <p className="text-muted-foreground mb-6">
        Create an account and share the login credentials with the {isEmployer ? "employer" : "job seeker"}.
      </p>

      {createdUser && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="text-green-600" size={20} />
            <p className="font-semibold text-green-800 dark:text-green-400">Account created successfully!</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-4 font-mono text-sm space-y-1 mb-3">
            <p><span className="text-muted-foreground">Email:</span> {createdUser.email}</p>
            <p><span className="text-muted-foreground">Password:</span> {createdUser.password}</p>
            <p><span className="text-muted-foreground">Login:</span> {window.location.origin}/login</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyCredentials} data-testid="button-copy-credentials">
              <Copy size={14} className="mr-2" /> Copy Credentials
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatedUser(null)}>
              Invite Another
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-5">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <FormControl><Input type="email" placeholder="user@example.com" data-testid="input-invite-email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary Password *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      data-testid="input-invite-password"
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {isEmployer ? (
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl><Input placeholder="Acme Trucking Co." data-testid="input-invite-company" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl><Input placeholder="John" data-testid="input-invite-first" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl><Input placeholder="Driver" data-testid="input-invite-last" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            <FormField control={form.control} name="membershipTier" render={({ field }) => (
              <FormItem>
                <FormLabel>Starting Membership Tier</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-invite-tier"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-create-invite">
              <UserPlus size={16} className="mr-2" />
              {createMutation.isPending ? "Creating..." : `Create ${isEmployer ? "Employer" : "Job Seeker"} Account`}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

// ─── BLOG TAB ─────────────────────────────────────────────────────────────────

const blogFormSchema = insertBlogPostSchema.omit({ authorId: true }).extend({
  title: z.string().min(3, "Title required"),
  content: z.string().min(20, "Content must be at least 20 characters"),
});

function BlogTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: posts, isLoading } = useQuery<BlogPost[]>({ queryKey: ["/api/blog"] });
  const [showForm, setShowForm] = useState(false);

  const form = useForm<z.infer<typeof blogFormSchema>>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: { title: "", content: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof blogFormSchema>) =>
      apiRequest("POST", "/api/blog", { ...values, authorId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      form.reset();
      setShowForm(false);
      toast({ title: "Post published!", description: "Your blog post is now live." });
    },
    onError: () => toast({ title: "Error", description: "Could not publish post.", variant: "destructive" }),
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Blog Posts ({posts?.length || 0})</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Write and publish industry articles for the TranspoJobs blog.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-blog-post">
          <Plus size={16} className="mr-2" /> {showForm ? "Cancel" : "New Post"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 mb-6">
          <h3 className="font-bold font-display text-lg mb-4">Write New Blog Post</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Post Title *</FormLabel>
                  <FormControl><Input placeholder="e.g. Top CDL Jobs in 2026" data-testid="input-blog-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your article content here..."
                      className="min-h-[280px] font-sans text-sm leading-relaxed"
                      data-testid="textarea-blog-content"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-publish-post">
                  {createMutation.isPending ? "Publishing..." : "Publish Post"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); form.reset(); }}>
                  Discard
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {!posts || posts.length === 0 ? (
        !showForm && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <FileText className="mx-auto mb-4 text-muted-foreground" size={40} />
            <h3 className="font-bold font-display text-lg mb-2">No blog posts yet</h3>
            <p className="text-muted-foreground mb-4">Write your first post to engage job seekers and employers.</p>
            <Button onClick={() => setShowForm(true)}>Write First Post</Button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} data-testid={`card-blog-admin-${post.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold font-display text-lg mb-1">{post.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : ""}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RESOURCES TAB ────────────────────────────────────────────────────────────

const resourceFormSchema = insertResourceSchema.extend({
  title: z.string().min(3, "Title required"),
  content: z.string().min(10, "Content required"),
});

function ResourcesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: resources, isLoading } = useQuery<Resource[]>({ queryKey: ["/api/resources"] });
  const [showForm, setShowForm] = useState(false);

  const form = useForm<z.infer<typeof resourceFormSchema>>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { title: "", content: "", targetAudience: "both", requiredTier: "free" },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof resourceFormSchema>) => apiRequest("POST", "/api/resources", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      form.reset();
      setShowForm(false);
      toast({ title: "Resource created!" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Resources ({resources?.length || 0})</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Manage the member resource library.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-resource">
          <Plus size={16} className="mr-2" /> {showForm ? "Cancel" : "Add Resource"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 mb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl><Input data-testid="input-resource-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content *</FormLabel>
                  <FormControl><Textarea className="min-h-[120px]" data-testid="textarea-resource-content" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="targetAudience" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audience</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-resource-audience"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="both">Everyone</SelectItem>
                        <SelectItem value="employer">Employers</SelectItem>
                        <SelectItem value="job_seeker">Job Seekers</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="requiredTier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required Tier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-resource-tier"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-resource">
                  {createMutation.isPending ? "Saving..." : "Save Resource"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      <div className="space-y-3">
        {(resources || []).map((r) => (
          <div key={r.id} data-testid={`card-resource-admin-${r.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-1">{r.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{r.content}</p>
            <div className="flex gap-2 mt-3">
              <Badge variant="outline" className="text-xs capitalize">{r.targetAudience.replace("_", " ")}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{r.requiredTier} tier</Badge>
            </div>
          </div>
        ))}
        {(!resources || resources.length === 0) && !showForm && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <BookOpen className="mx-auto mb-4 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">No resources yet. Add the first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT EXPORT ──────────────────────────────────────────────────────────────

export default function AdminDashboard({ section }: { section?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const content = () => {
    switch (section) {
      case "users": return <UsersTab />;
      case "jobs": return <AllJobsTab />;
      case "post-job": return <PostJobTab userId={user.id} />;
      case "upload-jobs": return <UploadJobsTab userId={user.id} />;
      case "invite-seeker": return <InviteUserTab targetRole="job_seeker" />;
      case "invite-employer": return <InviteUserTab targetRole="employer" />;
      case "blog": return <BlogTab />;
      case "resources": return <ResourcesTab />;
      default: return <UsersTab />;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {content()}
      </div>
    </DashboardLayout>
  );
}
