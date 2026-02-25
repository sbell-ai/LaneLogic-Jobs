import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Briefcase, BookOpen, FileText, Plus, Trash2,
  Upload, CheckCircle2, Copy, Eye, EyeOff, UserPlus,
  AlertCircle, Download, Pencil, X, Tag, Ticket
} from "lucide-react";
import type { User, Job, Resource, BlogPost, Category, Coupon, SiteSettingsData } from "@shared/schema";
import { insertResourceSchema, insertBlogPostSchema, insertJobSchema } from "@shared/schema";
import { z } from "zod";
import { formatDistanceToNow, format } from "date-fns";

// ─── USERS TAB ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: applications } = useQuery<import("@shared/schema").Application[]>({ queryKey: ["/api/applications"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", companyName: "", role: "", membershipTier: "" });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PUT", `/api/users/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
      toast({ title: "User updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
    },
  });

  const openEdit = (u: User) => {
    setEditForm({
      firstName: u.firstName || "", lastName: u.lastName || "",
      email: u.email, companyName: u.companyName || "",
      role: u.role, membershipTier: u.membershipTier,
    });
    setEditUser(u);
  };

  const filtered = (users || []).filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!search) return true;
    return `${u.email} ${u.firstName} ${u.lastName} ${u.companyName}`.toLowerCase().includes(search.toLowerCase());
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">All Users ({users?.length || 0})</h2>
        <div className="flex gap-3">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40" data-testid="select-role-filter">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="employer">Employers</SelectItem>
              <SelectItem value="job_seeker">Job Seekers</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search users..." className="w-64" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-user-search" />
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Joined</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tier</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Actions</th>
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
                    <Badge variant="outline" className="capitalize text-xs">{user.role.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className="capitalize text-xs">{user.membershipTier}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewUser(user)} data-testid={`button-view-user-${user.id}`}><Eye size={15} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)} data-testid={`button-edit-user-${user.id}`}><Pencil size={15} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this user?")) deleteMutation.mutate(user.id); }} data-testid={`button-delete-user-${user.id}`}><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">No users found.</div>}
      </div>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-edit-firstname" /></div>
              <div><Label>Last Name</Label><Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-edit-lastname" /></div>
            </div>
            <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} data-testid="input-edit-email" /></div>
            <div><Label>Company Name</Label><Input value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} data-testid="input-edit-company" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_seeker">Job Seeker</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Membership Tier</Label>
                <Select value={editForm.membershipTier} onValueChange={v => setEditForm(f => ({ ...f, membershipTier: v }))}>
                  <SelectTrigger data-testid="select-edit-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => editUser && updateMutation.mutate({ id: editUser.id, ...editForm })} data-testid="button-save-user">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>User Details</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Name</p><p className="font-medium">{viewUser.firstName} {viewUser.lastName}</p></div>
                <div><p className="text-muted-foreground">Email</p><p className="font-medium">{viewUser.email}</p></div>
                <div><p className="text-muted-foreground">Role</p><Badge variant="outline" className="capitalize">{viewUser.role.replace("_", " ")}</Badge></div>
                <div><p className="text-muted-foreground">Tier</p><Badge variant="outline" className="capitalize">{viewUser.membershipTier}</Badge></div>
                {viewUser.companyName && <div className="col-span-2"><p className="text-muted-foreground">Company</p><p className="font-medium">{viewUser.companyName}</p></div>}
                <div className="col-span-2"><p className="text-muted-foreground">Joined</p><p className="font-medium">{viewUser.createdAt ? format(new Date(viewUser.createdAt), "PPP") : "—"}</p></div>
              </div>
              {viewUser.role === "employer" && (
                <div>
                  <h4 className="font-semibold mb-2">Job Listings ({(jobs || []).filter(j => j.employerId === viewUser.id).length})</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(jobs || []).filter(j => j.employerId === viewUser.id).map(j => (
                      <div key={j.id} className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <p className="font-medium">{j.title}</p>
                        <p className="text-muted-foreground text-xs">{[j.locationCity, j.locationState].filter(Boolean).join(", ")}</p>
                      </div>
                    ))}
                    {(jobs || []).filter(j => j.employerId === viewUser.id).length === 0 && <p className="text-sm text-muted-foreground">No jobs posted.</p>}
                  </div>
                </div>
              )}
              {viewUser.role === "job_seeker" && (
                <div>
                  <h4 className="font-semibold mb-2">Applications ({(applications || []).filter(a => a.jobSeekerId === viewUser.id).length})</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(applications || []).filter(a => a.jobSeekerId === viewUser.id).map(a => {
                      const job = (jobs || []).find(j => j.id === a.jobId);
                      return (
                        <div key={a.id} className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg p-3 flex justify-between">
                          <p className="font-medium">{job?.title || `Job #${a.jobId}`}</p>
                          <Badge variant="outline" className="capitalize text-xs">{a.status}</Badge>
                        </div>
                      );
                    })}
                    {(applications || []).filter(a => a.jobSeekerId === viewUser.id).length === 0 && <p className="text-sm text-muted-foreground">No applications.</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ALL JOBS TAB ─────────────────────────────────────────────────────────────

function AllJobsTab() {
  const { data: jobs, isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: categories } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [indFilter, setIndFilter] = useState("all");
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PUT", `/api/jobs/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setEditJob(null);
      toast({ title: "Job updated" });
    },
  });

  const openEdit = (j: Job) => {
    setEditForm({
      title: j.title, companyName: j.companyName || "", jobType: j.jobType || "Full-time",
      category: j.category || "", industry: j.industry || "",
      description: j.description, requirements: j.requirements,
      benefits: j.benefits || "", salary: j.salary || "",
      locationCity: j.locationCity || "", locationState: j.locationState || "", locationCountry: j.locationCountry || "",
      applyUrl: j.applyUrl || "", isExternalApply: j.isExternalApply || false,
    });
    setEditJob(j);
  };

  const jobCats = (categories || []).filter(c => c.type === "job");
  const industries = (categories || []).filter(c => c.type === "industry");

  const fmtLoc = (j: Job) => [j.locationCity, j.locationState, j.locationCountry].filter(Boolean).join(", ");
  const filtered = (jobs || []).filter(j => {
    if (catFilter !== "all" && j.category !== catFilter) return false;
    if (indFilter !== "all" && j.industry !== indFilter) return false;
    if (!search) return true;
    return `${j.title} ${fmtLoc(j)} ${j.companyName || ""}`.toLowerCase().includes(search.toLowerCase());
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold font-display">All Jobs ({jobs?.length || 0})</h2>
        <div className="flex gap-2 flex-wrap">
          {jobCats.length > 0 && (
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {jobCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {industries.length > 0 && (
            <Select value={indFilter} onValueChange={setIndFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Industry" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Search jobs..." className="w-56" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-jobs-search" />
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((job) => (
          <div key={job.id} data-testid={`card-admin-job-${job.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{job.title}</h3>
                {job.companyName && <span className="text-sm text-muted-foreground">· {job.companyName}</span>}
                {job.category && <Badge variant="outline" className="text-xs">{job.category}</Badge>}
                {job.industry && <Badge variant="outline" className="text-xs">{job.industry}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {fmtLoc(job)}{job.salary ? ` · ${job.salary}` : ""}
                {job.jobType && <span className="ml-2 text-xs">{job.jobType}</span>}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewJob(job)} data-testid={`button-view-job-${job.id}`}><Eye size={15} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(job)} data-testid={`button-edit-job-${job.id}`}><Pencil size={15} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(job.id)} data-testid={`button-admin-delete-job-${job.id}`}><Trash2 size={15} /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <Briefcase className="mx-auto mb-4 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">No jobs found.</p>
          </div>
        )}
      </div>

      <Dialog open={!!viewJob} onOpenChange={() => setViewJob(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewJob?.title}</DialogTitle></DialogHeader>
          {viewJob && (
            <div className="space-y-3 text-sm">
              {viewJob.companyName && <div><p className="text-muted-foreground">Company</p><p className="font-medium">{viewJob.companyName}</p></div>}
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground">Location</p><p className="font-medium">{fmtLoc(viewJob) || "—"}</p></div>
                <div><p className="text-muted-foreground">Salary</p><p className="font-medium">{viewJob.salary || "—"}</p></div>
                <div><p className="text-muted-foreground">Job Type</p><p className="font-medium">{viewJob.jobType || "—"}</p></div>
                <div><p className="text-muted-foreground">Category</p><p className="font-medium">{viewJob.category || "—"}</p></div>
              </div>
              <div><p className="text-muted-foreground">Description</p><p className="whitespace-pre-wrap">{viewJob.description}</p></div>
              <div><p className="text-muted-foreground">Requirements</p><p className="whitespace-pre-wrap">{viewJob.requirements}</p></div>
              {viewJob.benefits && <div><p className="text-muted-foreground">Benefits</p><p className="whitespace-pre-wrap">{viewJob.benefits}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editJob} onOpenChange={() => setEditJob(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={editForm.title || ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-job-title" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Company Name</Label><Input value={editForm.companyName || ""} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} /></div>
              <div><Label>Job Type</Label>
                <Select value={editForm.jobType || "Full-time"} onValueChange={v => setEditForm(f => ({ ...f, jobType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Full-time","Part-time","Contract","Seasonal","Owner-Operator","Lease Purchase","Temporary"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label>
                <Select value={editForm.category || "none"} onValueChange={v => setEditForm(f => ({ ...f, category: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{jobCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Industry</Label>
                <Select value={editForm.industry || "none"} onValueChange={v => setEditForm(f => ({ ...f, industry: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{industries.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>City</Label><Input value={editForm.locationCity || ""} onChange={e => setEditForm(f => ({ ...f, locationCity: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={editForm.locationState || ""} onChange={e => setEditForm(f => ({ ...f, locationState: e.target.value }))} /></div>
              <div><Label>Country</Label><Input value={editForm.locationCountry || ""} onChange={e => setEditForm(f => ({ ...f, locationCountry: e.target.value }))} /></div>
            </div>
            <div><Label>Salary</Label><Input value={editForm.salary || ""} onChange={e => setEditForm(f => ({ ...f, salary: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="min-h-[100px]" /></div>
            <div><Label>Requirements</Label><Textarea value={editForm.requirements || ""} onChange={e => setEditForm(f => ({ ...f, requirements: e.target.value }))} className="min-h-[80px]" /></div>
            <div><Label>Benefits</Label><Textarea value={editForm.benefits || ""} onChange={e => setEditForm(f => ({ ...f, benefits: e.target.value }))} className="min-h-[60px]" /></div>
            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => editJob && updateMutation.mutate({ id: editJob.id, ...editForm })} data-testid="button-save-edit-job">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── POST JOB TAB (Admin) ─────────────────────────────────────────────────────

const ADMIN_JOB_TYPES = ["Full-time", "Part-time", "Contract", "Seasonal", "Owner-Operator", "Lease Purchase", "Temporary"];

const jobFormSchema = insertJobSchema.omit({ employerId: true }).extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  requirements: z.string().min(10, "Requirements must be at least 10 characters"),
});

function PostJobTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const jobCats = (categories || []).filter(c => c.type === "job");
  const industries = (categories || []).filter(c => c.type === "industry");

  const form = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "", companyName: "", jobType: "Full-time",
      description: "", requirements: "", benefits: "",
      locationCity: "", locationState: "", locationCountry: "USA",
      salary: "", applyUrl: "", isExternalApply: false,
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
                    <SelectContent>{ADMIN_JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
                  <FormLabel>Job Category</FormLabel>
                  <Select onValueChange={v => field.onChange(v === "none" ? "" : v)} defaultValue={field.value || "none"}>
                    <FormControl><SelectTrigger data-testid="select-job-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {jobCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select onValueChange={v => field.onChange(v === "none" ? "" : v)} defaultValue={field.value || "none"}>
                    <FormControl><SelectTrigger data-testid="select-job-industry"><SelectValue placeholder="Select industry" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {industries.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="salary" render={({ field }) => (
              <FormItem>
                <FormLabel>Salary (optional)</FormLabel>
                <FormControl><Input placeholder="$70,000 – $90,000" data-testid="input-job-salary" {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Description *</FormLabel>
                <FormControl><Textarea placeholder="Role overview, responsibilities, and company culture..." className="min-h-[130px]" data-testid="textarea-job-description" {...field} /></FormControl>
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

            <FormField control={form.control} name="benefits" render={({ field }) => (
              <FormItem>
                <FormLabel>Benefits (optional)</FormLabel>
                <FormControl><Textarea placeholder="Health insurance, 401k, sign-on bonus..." className="min-h-[80px]" data-testid="textarea-job-benefits" {...field} value={field.value ?? ""} /></FormControl>
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
  companyName?: string;
  jobType?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  description: string;
  requirements: string;
  benefits?: string;
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
          if (!row.title) continue;
          rows.push({
            title: row.title,
            companyName: row.companyname || row.company_name || row.company || undefined,
            jobType: row.jobtype || row.job_type || row.type || undefined,
            locationCity: row.locationcity || row.location_city || row.city || undefined,
            locationState: row.locationstate || row.location_state || row.state || undefined,
            locationCountry: row.locationcountry || row.location_country || row.country || undefined,
            description: row.description || "Please contact us for full job details.",
            requirements: row.requirements || "Please contact us for requirements.",
            benefits: row.benefits || undefined,
            salary: row.salary || undefined,
            applyUrl: row.applyurl || row.apply_url || undefined,
          });
        }
        if (rows.length === 0) {
          setError("No valid rows found. Ensure the CSV has a 'title' column.");
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

  const sampleCsv = `title,companyName,jobType,locationCity,locationState,locationCountry,description,requirements,benefits,salary,applyUrl
CDL Class A Driver,Fast Trucking Co.,Full-time,Chicago,IL,USA,"Looking for an experienced long haul driver","CDL Class A required; 3+ years experience","Health insurance; 401k",$80000,
Fleet Dispatcher,Metro Logistics,Contract,Atlanta,GA,USA,"Manage driver schedules and routes","2+ years dispatching experience","PTO; remote options","$55,000–$65,000",https://example.com/apply`;

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
        <p className="font-semibold mb-1">Required column:</p>
        <code className="text-xs">title</code>
        <p className="mt-1">Optional: <code className="text-xs">companyName, jobType, locationCity, locationState, locationCountry, description, requirements, benefits, salary, applyUrl</code></p>
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
                <p className="font-semibold">{job.title}{job.companyName ? ` · ${job.companyName}` : ""}</p>
                <p className="text-muted-foreground">
                  {[job.locationCity, job.locationState, job.locationCountry].filter(Boolean).join(", ")}
                  {job.jobType ? ` · ${job.jobType}` : ""}
                  {job.salary ? ` · ${job.salary}` : ""}
                </p>
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
  const { data: categories } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const [showForm, setShowForm] = useState(false);
  const [editPost, setEditPost] = useState<BlogPost | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "" });

  const blogCats = (categories || []).filter(c => c.type === "blog");

  const form = useForm<z.infer<typeof blogFormSchema>>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: { title: "", content: "", category: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof blogFormSchema>) =>
      apiRequest("POST", "/api/blog", { ...values, authorId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      form.reset();
      setShowForm(false);
      toast({ title: "Post published!" });
    },
    onError: () => toast({ title: "Error", description: "Could not publish post.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PUT", `/api/blog/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setEditPost(null);
      toast({ title: "Post updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/blog/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Post deleted" });
    },
  });

  const openEdit = (p: BlogPost) => {
    setEditForm({ title: p.title, content: p.content, category: p.category || "" });
    setEditPost(p);
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Blog Posts ({posts?.length || 0})</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Write and publish industry articles.</p>
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
              {blogCats.length > 0 && (
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl><SelectTrigger data-testid="select-blog-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {blogCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Write your article content here..." className="min-h-[280px] font-sans text-sm leading-relaxed" data-testid="textarea-blog-content" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-publish-post">
                  {createMutation.isPending ? "Publishing..." : "Publish Post"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); form.reset(); }}>Discard</Button>
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
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold font-display text-lg">{post.title}</h3>
                    {post.category && <Badge variant="outline" className="text-xs">{post.category}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(post)} data-testid={`button-edit-blog-${post.id}`}><Pencil size={15} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this post?")) deleteMutation.mutate(post.id); }} data-testid={`button-delete-blog-${post.id}`}><Trash2 size={15} /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editPost} onOpenChange={() => setEditPost(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Blog Post</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-blog-title" /></div>
            {blogCats.length > 0 && (
              <div>
                <Label>Category</Label>
                <Select value={editForm.category || "none"} onValueChange={v => setEditForm(f => ({ ...f, category: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {blogCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Content</Label><Textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} className="min-h-[200px]" data-testid="textarea-edit-blog-content" /></div>
            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => editPost && updateMutation.mutate({ id: editPost.id, ...editForm })} data-testid="button-save-edit-blog">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", targetAudience: "both", requiredTier: "free" });

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

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PUT", `/api/resources/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      setEditResource(null);
      toast({ title: "Resource updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
      toast({ title: "Resource deleted" });
    },
  });

  const openEdit = (r: Resource) => {
    setEditForm({ title: r.title, content: r.content, targetAudience: r.targetAudience, requiredTier: r.requiredTier });
    setEditResource(r);
  };

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
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{r.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{r.content}</p>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-xs capitalize">{r.targetAudience.replace("_", " ")}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{r.requiredTier} tier</Badge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} data-testid={`button-edit-resource-${r.id}`}><Pencil size={15} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this resource?")) deleteMutation.mutate(r.id); }} data-testid={`button-delete-resource-${r.id}`}><Trash2 size={15} /></Button>
              </div>
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

      <Dialog open={!!editResource} onOpenChange={() => setEditResource(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Resource</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-resource-title" /></div>
            <div><Label>Content</Label><Textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} className="min-h-[120px]" data-testid="textarea-edit-resource-content" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Audience</Label>
                <Select value={editForm.targetAudience} onValueChange={v => setEditForm(f => ({ ...f, targetAudience: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Everyone</SelectItem>
                    <SelectItem value="employer">Employers</SelectItem>
                    <SelectItem value="job_seeker">Job Seekers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Required Tier</Label>
                <Select value={editForm.requiredTier} onValueChange={v => setEditForm(f => ({ ...f, requiredTier: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => editResource && updateMutation.mutate({ id: editResource.id, ...editForm })} data-testid="button-save-edit-resource">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── CATEGORIES TAB ──────────────────────────────────────────────────────────

function CategoriesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories, isLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"job" | "industry" | "blog">("job");

  const createMutation = useMutation({
    mutationFn: (data: { name: string; type: string }) => apiRequest("POST", "/api/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewName("");
      toast({ title: "Category added" });
    },
    onError: () => toast({ title: "Error", description: "Could not add category.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category removed" });
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), type: newType });
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  const jobCats = (categories || []).filter(c => c.type === "job");
  const industries = (categories || []).filter(c => c.type === "industry");
  const blogCats = (categories || []).filter(c => c.type === "blog");

  const renderSection = (title: string, type: "job" | "industry" | "blog", items: Category[]) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
      <h3 className="font-bold font-display text-lg mb-4">{title}</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {items.map(c => (
          <Badge key={c.id} variant="secondary" className="text-sm py-1.5 px-3 gap-2" data-testid={`badge-category-${c.id}`}>
            {c.name}
            <button onClick={() => deleteMutation.mutate(c.id)} className="hover:text-destructive"><X size={14} /></button>
          </Badge>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={`Add ${title.toLowerCase().replace(/ies$/, "y").replace(/s$/, "")}...`}
          value={newType === type ? newName : ""}
          onChange={e => { setNewType(type); setNewName(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter" && newType === type) { e.preventDefault(); handleAdd(); } }}
          className="max-w-xs"
          data-testid={`input-add-${type}-category`}
        />
        <Button
          size="sm"
          disabled={createMutation.isPending || !newName.trim() || newType !== type}
          onClick={() => { setNewType(type); handleAdd(); }}
          data-testid={`button-add-${type}-category`}
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display">Categories & Labels</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage categories for jobs, industries, and blog posts.</p>
      </div>
      <div className="space-y-6">
        {renderSection("Job Categories", "job", jobCats)}
        {renderSection("Industries", "industry", industries)}
        {renderSection("Blog Categories", "blog", blogCats)}
      </div>
    </div>
  );
}

// ─── COUPONS TAB ────────────────────────────────────────────────────────────

function CouponsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: coupons, isLoading } = useQuery<Coupon[]>({ queryKey: ["/api/coupons"] });
  const [showForm, setShowForm] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: "", discountType: "percent" as "percent" | "fixed",
    discountValue: "", maxUses: "", expiresAt: "",
    isActive: true, appliesTo: "all" as "basic" | "premium" | "all",
  });

  const resetForm = () => {
    setFormData({ code: "", discountType: "percent", discountValue: "", maxUses: "", expiresAt: "", isActive: true, appliesTo: "all" });
    setEditCoupon(null);
    setShowForm(false);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      resetForm();
      toast({ title: "Coupon created" });
    },
    onError: () => toast({ title: "Error", description: "Could not create coupon.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }: { id: number; [key: string]: any }) =>
      apiRequest("PUT", `/api/coupons/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      resetForm();
      toast({ title: "Coupon updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Coupon deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PUT", `/api/coupons/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
    },
  });

  const openEdit = (c: Coupon) => {
    setFormData({
      code: c.code, discountType: c.discountType as "percent" | "fixed",
      discountValue: String(c.discountValue), maxUses: c.maxUses ? String(c.maxUses) : "",
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : "",
      isActive: c.isActive, appliesTo: (c.appliesTo || "all") as "basic" | "premium" | "all",
    });
    setEditCoupon(c);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      code: formData.code.toUpperCase(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      maxUses: formData.maxUses ? Number(formData.maxUses) : null,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      isActive: formData.isActive,
      appliesTo: formData.appliesTo,
    };
    if (editCoupon) {
      updateMutation.mutate({ id: editCoupon.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Coupon Codes ({coupons?.length || 0})</h2>
          <p className="text-muted-foreground text-sm mt-1">Create and manage promotional discount codes.</p>
        </div>
        <Button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }} data-testid="button-add-coupon">
          <Plus size={16} className="mr-2" /> {showForm ? "Cancel" : "New Coupon"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 mb-6">
          <h3 className="font-bold font-display text-lg mb-4">{editCoupon ? "Edit Coupon" : "Create New Coupon"}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Coupon Code *</Label>
                <Input value={formData.code} onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SAVE20" data-testid="input-coupon-code" />
              </div>
              <div>
                <Label>Discount Type</Label>
                <Select value={formData.discountType} onValueChange={v => setFormData(f => ({ ...f, discountType: v as "percent" | "fixed" }))}>
                  <SelectTrigger data-testid="select-coupon-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Discount Value *</Label>
                <Input type="number" value={formData.discountValue} onChange={e => setFormData(f => ({ ...f, discountValue: e.target.value }))} placeholder={formData.discountType === "percent" ? "20" : "5.00"} data-testid="input-coupon-value" />
              </div>
              <div>
                <Label>Max Uses</Label>
                <Input type="number" value={formData.maxUses} onChange={e => setFormData(f => ({ ...f, maxUses: e.target.value }))} placeholder="Unlimited" data-testid="input-coupon-max-uses" />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={formData.expiresAt} onChange={e => setFormData(f => ({ ...f, expiresAt: e.target.value }))} data-testid="input-coupon-expiry" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Applies To</Label>
                <Select value={formData.appliesTo} onValueChange={v => setFormData(f => ({ ...f, appliesTo: v as "basic" | "premium" | "all" }))}>
                  <SelectTrigger data-testid="select-coupon-applies"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="basic">Basic Only</SelectItem>
                    <SelectItem value="premium">Premium Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Label>Active</Label>
                <Switch checked={formData.isActive} onCheckedChange={v => setFormData(f => ({ ...f, isActive: v }))} data-testid="switch-coupon-active" />
              </div>
            </div>
            <Button className="w-full" disabled={createMutation.isPending || updateMutation.isPending || !formData.code || !formData.discountValue} onClick={handleSubmit} data-testid="button-save-coupon">
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editCoupon ? "Update Coupon" : "Create Coupon"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(coupons || []).map((coupon) => {
          const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
          const usageText = coupon.maxUses ? `${coupon.currentUses}/${coupon.maxUses} uses` : `${coupon.currentUses} uses`;
          return (
            <div key={coupon.id} data-testid={`card-coupon-${coupon.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="font-bold text-lg tracking-wider">{coupon.code}</code>
                    <Badge variant={coupon.isActive && !isExpired ? "default" : "secondary"} className="text-xs">
                      {isExpired ? "Expired" : coupon.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">{coupon.appliesTo} plans</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {coupon.discountType === "percent" ? `${coupon.discountValue}% off` : `$${coupon.discountValue} off`}
                    {" · "}{usageText}
                    {coupon.expiresAt && ` · Expires ${format(new Date(coupon.expiresAt), "MMM d, yyyy")}`}
                  </p>
                </div>
                <div className="flex gap-1 items-center shrink-0">
                  <Switch checked={coupon.isActive} onCheckedChange={v => toggleMutation.mutate({ id: coupon.id, isActive: v })} data-testid={`switch-toggle-coupon-${coupon.id}`} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(coupon)} data-testid={`button-edit-coupon-${coupon.id}`}><Pencil size={15} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this coupon?")) deleteMutation.mutate(coupon.id); }} data-testid={`button-delete-coupon-${coupon.id}`}><Trash2 size={15} /></Button>
                </div>
              </div>
            </div>
          );
        })}
        {(!coupons || coupons.length === 0) && !showForm && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
            <Ticket className="mx-auto mb-4 text-muted-foreground" size={40} />
            <h3 className="font-bold font-display text-lg mb-2">No coupons yet</h3>
            <p className="text-muted-foreground mb-4">Create your first promotional discount code.</p>
            <Button onClick={() => setShowForm(true)}>Create First Coupon</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SITE PAGES TAB ──────────────────────────────────────────────────────────

function SitePagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: saved, isLoading } = useQuery<SiteSettingsData>({ queryKey: ["/api/settings"] });

  const [draft, setDraft] = useState<Record<string, string>>({
    loginHeading: "",
    loginSubtitle: "",
    loginTestimonial: "",
    loginTestimonialAuthor: "",
    loginBackgroundImage: "",
    signupHeading: "",
    signupSubtitle: "",
    signupDescription: "",
  });

  useEffect(() => {
    if (saved) {
      setDraft({
        loginHeading: saved.loginHeading ?? "",
        loginSubtitle: saved.loginSubtitle ?? "",
        loginTestimonial: saved.loginTestimonial ?? "",
        loginTestimonialAuthor: saved.loginTestimonialAuthor ?? "",
        loginBackgroundImage: saved.loginBackgroundImage ?? "",
        signupHeading: saved.signupHeading ?? "",
        signupSubtitle: saved.signupSubtitle ?? "",
        signupDescription: saved.signupDescription ?? "",
      });
    }
  }, [saved]);

  const updateMutation = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      apiRequest("PUT", "/api/settings", { ...saved, ...settings }).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.setQueryData(["/api/settings"], data);
      toast({ title: "Site pages settings saved!", description: "Changes are now live." });
    },
    onError: () => toast({ title: "Error", description: "Could not save settings.", variant: "destructive" }),
  });

  const update = (key: string, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display">Site Pages</h2>
        <p className="text-muted-foreground text-sm mt-1">Customize the text and images on your Login and Signup pages.</p>
      </div>

      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
          <h3 className="font-bold font-display text-lg mb-5 pb-4 border-b border-border">Login Page</h3>
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-1 block">Heading</Label>
              <p className="text-xs text-muted-foreground mb-2">Main heading shown on the login page.</p>
              <Input
                value={draft.loginHeading}
                onChange={e => update("loginHeading", e.target.value)}
                placeholder="Welcome back"
                data-testid="input-login-heading"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Subtitle</Label>
              <p className="text-xs text-muted-foreground mb-2">Subtitle text below the heading.</p>
              <Input
                value={draft.loginSubtitle}
                onChange={e => update("loginSubtitle", e.target.value)}
                placeholder="Log in to your account to continue"
                data-testid="input-login-subtitle"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Testimonial</Label>
              <p className="text-xs text-muted-foreground mb-2">Testimonial quote shown on the login page image panel.</p>
              <Textarea
                value={draft.loginTestimonial}
                onChange={e => update("loginTestimonial", e.target.value)}
                placeholder="TranspoJobs helped us find qualified CDL drivers..."
                className="min-h-[80px] resize-none"
                data-testid="textarea-login-testimonial"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Testimonial Author</Label>
              <p className="text-xs text-muted-foreground mb-2">Attribution line for the testimonial.</p>
              <Input
                value={draft.loginTestimonialAuthor}
                onChange={e => update("loginTestimonialAuthor", e.target.value)}
                placeholder="Sarah Jenkins, Logistics Director at FastFreight"
                data-testid="input-login-testimonial-author"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Background Image URL</Label>
              <p className="text-xs text-muted-foreground mb-2">URL of the background image on the right side of the login page.</p>
              <Input
                value={draft.loginBackgroundImage}
                onChange={e => update("loginBackgroundImage", e.target.value)}
                placeholder="https://images.unsplash.com/..."
                data-testid="input-login-background-image"
              />
              {draft.loginBackgroundImage && (
                <div className="mt-3 rounded-xl border border-border overflow-hidden">
                  <img src={draft.loginBackgroundImage} alt="Login background preview" className="w-full h-32 object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
          <h3 className="font-bold font-display text-lg mb-5 pb-4 border-b border-border">Signup Page</h3>
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-1 block">Heading</Label>
              <p className="text-xs text-muted-foreground mb-2">Main heading shown on the signup page.</p>
              <Input
                value={draft.signupHeading}
                onChange={e => update("signupHeading", e.target.value)}
                placeholder="Create an account"
                data-testid="input-signup-heading"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Subtitle</Label>
              <p className="text-xs text-muted-foreground mb-2">Subtitle text below the heading.</p>
              <Input
                value={draft.signupSubtitle}
                onChange={e => update("signupSubtitle", e.target.value)}
                placeholder="Join TranspoJobs to take the next step"
                data-testid="input-signup-subtitle"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Description</Label>
              <p className="text-xs text-muted-foreground mb-2">Description text shown on the right side panel of the signup page.</p>
              <Textarea
                value={draft.signupDescription}
                onChange={e => update("signupDescription", e.target.value)}
                placeholder="Connect with thousands of transportation and logistics companies..."
                className="min-h-[80px] resize-none"
                data-testid="textarea-signup-description"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end p-4 bg-white dark:bg-slate-900 rounded-2xl border border-border">
          <Button
            onClick={() => updateMutation.mutate(draft)}
            disabled={updateMutation.isPending}
            data-testid="button-save-site-pages"
            className="gap-2"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
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
      case "categories": return <CategoriesTab />;
      case "coupons": return <CouponsTab />;
      case "site-pages": return <SitePagesTab />;
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
