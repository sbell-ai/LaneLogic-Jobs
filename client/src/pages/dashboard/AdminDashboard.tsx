import { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { formatJobLocation } from "@/components/JobFilterSidebar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Briefcase, BookOpen, FileText, Plus, Trash2,
  Upload, CheckCircle2, Copy, Eye, EyeOff, UserPlus,
  AlertCircle, Download, Pencil, X, Tag, Ticket, ExternalLink,
  FilePlus2, Globe, Search as SearchIcon, Share2, PlusCircle, ArrowLeft,
  FileEdit, LayoutList, UserCircle, ChevronDown, ChevronRight, Info,
  Building2, ImageIcon, Mail, Save, Send, AlertTriangle, ToggleLeft, ToggleRight
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ImageUpload } from "@/components/ui/image-upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { User, Job, Resource, BlogPost, Category, Coupon, SiteSettingsData, Page } from "@shared/schema";
import { ShareToSocialModal } from "@/components/ShareToSocialModal";
import SocialPublishing from "./SocialPublishing";
import ProductManagement from "./ProductManagement";
import ImportManagement from "./ImportManagement";
import EmployerRegistry from "./EmployerRegistry";
import VerificationInbox from "./VerificationInbox";
import SeekerVerificationInbox from "./SeekerVerificationInbox";
import { insertResourceSchema, insertBlogPostSchema, insertJobSchema } from "@shared/schema";
import { INTRO_TRUNCATE_LENGTH } from "@shared/constants";
import { tokenize } from "@/lib/linkify";
import { z } from "zod";
import { formatDistanceToNow, format } from "date-fns";
import { validateCategoryPair } from "@shared/jobTaxonomy";
import { useTaxonomy, type TaxonomyData } from "@/hooks/use-taxonomy";

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
  const [subCatFilter, setSubCatFilter] = useState("all");
  const [indFilter, setIndFilter] = useState("all");
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<{ jobType: string; category: string; subcategory: string; industry: string }>({ jobType: "", category: "", subcategory: "", industry: "" });
  const [shareJob, setShareJob] = useState<Job | null>(null);
  const { categories: taxonomyCategories, getSubcategories } = useTaxonomy();

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

  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { ids: number[]; updates: Record<string, string> }) =>
      apiRequest("PUT", "/api/jobs-bulk-update", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setBulkEditOpen(false);
      setSelectedIds(new Set());
      setBulkForm({ jobType: "", category: "", subcategory: "", industry: "" });
      toast({ title: "Jobs updated" });
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(j => j.id)));
    }
  };

  const handleBulkSave = () => {
    const updates: Record<string, string> = {};
    if (bulkForm.jobType && bulkForm.jobType !== "__unchanged__") updates.jobType = bulkForm.jobType;
    if (bulkForm.category && bulkForm.category !== "__unchanged__") {
      updates.category = bulkForm.category === "__clear__" ? "" : bulkForm.category;
      if (bulkForm.category === "__clear__") updates.subcategory = "";
    }
    if (bulkForm.subcategory && bulkForm.subcategory !== "__unchanged__") updates.subcategory = bulkForm.subcategory === "__clear__" ? "" : bulkForm.subcategory;
    if (bulkForm.industry && bulkForm.industry !== "__unchanged__") updates.industry = bulkForm.industry === "__clear__" ? "" : bulkForm.industry;
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "Select at least one field to update.", variant: "destructive" });
      return;
    }
    if ("category" in updates && updates.category) {
      const pairCheck = validateCategoryPair(updates.category, updates.subcategory ?? null);
      if (!pairCheck.valid) { toast({ title: "Validation Error", description: pairCheck.error, variant: "destructive" }); return; }
    }
    if ("subcategory" in updates && updates.subcategory && !("category" in updates)) {
      toast({ title: "Validation Error", description: "Category is required when changing subcategory.", variant: "destructive" });
      return;
    }
    bulkUpdateMutation.mutate({ ids: [...selectedIds], updates });
  };

  const openEdit = (j: Job) => {
    setEditForm({
      title: j.title, companyName: j.companyName || "", jobType: j.jobType || "",
      category: j.category || "", subcategory: j.subcategory || "", industry: j.industry || "",
      description: j.description, requirements: j.requirements,
      benefits: j.benefits || "", salary: j.salary || "",
      locationCity: j.locationCity || "", locationState: j.locationState || "", locationCountry: j.locationCountry || "",
      workLocationType: j.workLocationType || "",
      applyUrl: j.applyUrl || "", isExternalApply: j.isExternalApply || false,
      expiresAt: j.expiresAt ? new Date(j.expiresAt).toISOString().slice(0, 10) : "",
      isPublished: j.isPublished ?? false,
    });
    setEditJob(j);
  };

  const industries = (categories || []).filter(c => c.type === "industry");

  const fmtLoc = (j: Job) => formatJobLocation(j);
  const filtered = (jobs || []).filter(j => {
    if (catFilter === "__missing__") { if (j.category) return false; }
    else if (catFilter !== "all" && j.category !== catFilter) return false;
    if (subCatFilter !== "all" && j.subcategory !== subCatFilter) return false;
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
          <Link href="/dashboard/admin/post-job">
            <Button size="sm" data-testid="button-go-post-job">
              <PlusCircle size={14} className="mr-1.5" /> Post a Job
            </Button>
          </Link>
          <Link href="/dashboard/admin/upload-jobs">
            <Button size="sm" variant="outline" data-testid="button-go-upload-jobs">
              <Upload size={14} className="mr-1.5" /> Upload Jobs (CSV)
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-6">
          <Select value={catFilter} onValueChange={v => { setCatFilter(v); setSubCatFilter("all"); }}>
            <SelectTrigger className="w-48" data-testid="select-filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="__missing__">Missing Category</SelectItem>
              {taxonomyCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {catFilter !== "all" && catFilter !== "__missing__" && (
            <Select value={subCatFilter} onValueChange={setSubCatFilter}>
              <SelectTrigger className="w-48" data-testid="select-filter-subcategory"><SelectValue placeholder="Subcategory" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subcategories</SelectItem>
                {getSubcategories(catFilter).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-3" data-testid="bulk-action-bar">
          <span className="text-sm font-medium">{selectedIds.size} job{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <Button size="sm" onClick={() => { setBulkForm({ jobType: "", category: "", subcategory: "", industry: "" }); setBulkEditOpen(true); }} data-testid="button-bulk-edit">
            <Pencil size={14} className="mr-1.5" /> Bulk Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">Clear</Button>
        </div>
      )}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-5 py-2">
          <Checkbox
            checked={filtered.length > 0 && selectedIds.size === filtered.length}
            onCheckedChange={toggleSelectAll}
            data-testid="checkbox-select-all-jobs"
          />
          <span className="text-sm text-muted-foreground font-medium">Select All</span>
        </div>
        {filtered.map((job) => (
          <div key={job.id} data-testid={`card-admin-job-${job.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Checkbox
                checked={selectedIds.has(job.id)}
                onCheckedChange={() => toggleSelect(job.id)}
                data-testid={`checkbox-job-${job.id}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{job.title}</h3>
                  {job.companyName && <span className="text-sm text-muted-foreground">· {job.companyName}</span>}
                  {job.category && <Badge variant="outline" className="text-xs">{job.category}</Badge>}
                  {job.subcategory && <Badge variant="outline" className="text-xs">{job.subcategory}</Badge>}
                  {job.industry && <Badge variant="outline" className="text-xs">{job.industry}</Badge>}
                  {!job.isPublished && <Badge variant="secondary" className="text-xs" data-testid={`badge-draft-job-${job.id}`}>Draft</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {fmtLoc(job)}{job.salary ? ` · ${job.salary}` : ""}
                  {job.jobType && <span className="ml-2 text-xs">{job.jobType}</span>}
                </p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewJob(job)} data-testid={`button-view-job-${job.id}`}><Eye size={15} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(job)} data-testid={`button-edit-job-${job.id}`}><Pencil size={15} /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareJob(job)} data-testid={`button-share-job-${job.id}`}><Share2 size={15} /></Button>
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
                <div><p className="text-muted-foreground">Subcategory</p><p className="font-medium">{viewJob.subcategory || "—"}</p></div>
                <div><p className="text-muted-foreground">Expires</p><p className="font-medium">{viewJob.expiresAt ? new Date(viewJob.expiresAt).toLocaleDateString() : "No expiration"}</p></div>
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
                <Select value={editForm.category || "none"} onValueChange={v => setEditForm(f => ({ ...f, category: v === "none" ? "" : v, subcategory: "" }))}>
                  <SelectTrigger data-testid="select-edit-category"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{taxonomyCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Subcategory</Label>
                <Select value={editForm.subcategory || "none"} onValueChange={v => setEditForm(f => ({ ...f, subcategory: v === "none" ? "" : v }))} disabled={!editForm.category}>
                  <SelectTrigger data-testid="select-edit-subcategory"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{editForm.category && getSubcategories(editForm.category).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div>
              <Label>Work Location Type</Label>
              <Select value={editForm.workLocationType || "none"} onValueChange={v => setEditForm(f => ({ ...f, workLocationType: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-edit-work-location-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="on_site">On-site</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="otr">OTR</SelectItem>
                  <SelectItem value="field_based">Field-based</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Salary</Label><Input value={editForm.salary || ""} onChange={e => setEditForm(f => ({ ...f, salary: e.target.value }))} /></div>
              <div><Label>Expiration Date</Label><Input type="date" value={editForm.expiresAt || ""} onChange={e => setEditForm(f => ({ ...f, expiresAt: e.target.value }))} data-testid="input-edit-job-expires" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="min-h-[100px]" /></div>
            <div><Label>Requirements</Label><Textarea value={editForm.requirements || ""} onChange={e => setEditForm(f => ({ ...f, requirements: e.target.value }))} className="min-h-[80px]" /></div>
            <div><Label>Benefits</Label><Textarea value={editForm.benefits || ""} onChange={e => setEditForm(f => ({ ...f, benefits: e.target.value }))} className="min-h-[60px]" /></div>
            <div className="flex items-center justify-between py-2 px-1 border rounded-lg">
              <Label className="font-medium">Published</Label>
              <Switch
                checked={editForm.isPublished ?? false}
                onCheckedChange={v => setEditForm(f => ({ ...f, isPublished: v }))}
                data-testid="switch-job-published"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={updateMutation.isPending} onClick={() => {
                if (!editJob) return;
                const catVal = editForm.category || null;
                const subVal = editForm.subcategory || null;
                const pairCheck = validateCategoryPair(catVal, subVal);
                if (!pairCheck.valid) { toast({ title: "Validation Error", description: pairCheck.error, variant: "destructive" }); return; }
                const updates = { ...editForm, expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null };
                if (updates.isPublished && !editJob.isPublished) updates.publishedAt = new Date().toISOString();
                if (!updates.isPublished && editJob.isPublished) updates.publishedAt = null;
                updateMutation.mutate({ id: editJob.id, ...updates });
              }} data-testid="button-save-edit-job">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => { if (editJob) setShareJob(editJob); }} data-testid="button-share-from-edit-job">
                <Share2 size={15} className="mr-1.5" /> Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {shareJob && (
        <ShareToSocialModal
          entityType="job"
          entityId={shareJob.id}
          entityTitle={shareJob.title}
          isPublished={shareJob.isPublished ?? false}
          isExpired={!!(shareJob.expiresAt && new Date(shareJob.expiresAt) < new Date())}
          isOpen={!!shareJob}
          onClose={() => setShareJob(null)}
          entityLocation={[shareJob.locationCity, shareJob.locationState].filter(Boolean).join(", ") || undefined}
          entitySalary={shareJob.salary || undefined}
        />
      )}

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-bulk-edit">
          <DialogHeader>
            <DialogTitle>Bulk Edit {selectedIds.size} Job{selectedIds.size !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Only fields you change will be updated. Leave a field unchanged to keep existing values.</p>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Job Type</Label>
              <Select value={bulkForm.jobType} onValueChange={v => setBulkForm(f => ({ ...f, jobType: v }))}>
                <SelectTrigger data-testid="select-bulk-job-type"><SelectValue placeholder="— No change —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unchanged__">— No change —</SelectItem>
                  {["Full-time","Part-time","Contract","Seasonal","Owner-Operator","Lease Purchase","Temporary"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Category</Label>
              <Select value={bulkForm.category} onValueChange={v => setBulkForm(f => ({ ...f, category: v, subcategory: v === "__clear__" ? "__clear__" : "" }))}>
                <SelectTrigger data-testid="select-bulk-category"><SelectValue placeholder="— No change —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unchanged__">— No change —</SelectItem>
                  <SelectItem value="__clear__">Clear category</SelectItem>
                  {taxonomyCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {bulkForm.category && bulkForm.category !== "__unchanged__" && bulkForm.category !== "__clear__" && (
              <div>
                <Label className="text-sm font-semibold mb-1.5 block">Subcategory</Label>
                <Select value={bulkForm.subcategory} onValueChange={v => setBulkForm(f => ({ ...f, subcategory: v }))}>
                  <SelectTrigger data-testid="select-bulk-subcategory"><SelectValue placeholder="— No change —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unchanged__">— No change —</SelectItem>
                    <SelectItem value="__clear__">Clear subcategory</SelectItem>
                    {getSubcategories(bulkForm.category).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Industry</Label>
              <Select value={bulkForm.industry} onValueChange={v => setBulkForm(f => ({ ...f, industry: v }))}>
                <SelectTrigger data-testid="select-bulk-industry"><SelectValue placeholder="— No change —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unchanged__">— No change —</SelectItem>
                  <SelectItem value="__clear__">Clear industry</SelectItem>
                  {industries.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={bulkUpdateMutation.isPending} onClick={handleBulkSave} data-testid="button-save-bulk-edit">
              {bulkUpdateMutation.isPending ? "Updating..." : `Update ${selectedIds.size} Job${selectedIds.size !== 1 ? "s" : ""}`}
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
  const industries = (categories || []).filter(c => c.type === "industry");
  const { categories: taxonomyCats, getSubcategories } = useTaxonomy();

  const form = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "", companyName: "", jobType: "Full-time",
      category: "", subcategory: "", industry: "",
      description: "", requirements: "", benefits: "",
      locationCity: "", locationState: "", locationCountry: "USA",
      workLocationType: "",
      salary: "", applyUrl: "", isExternalApply: false,
      expiresAt: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof jobFormSchema>) => {
      const payload = { ...values, employerId: userId, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null };
      return apiRequest("POST", "/api/jobs", payload);
    },
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

            <FormField control={form.control} name="workLocationType" render={({ field }) => (
              <FormItem>
                <FormLabel>Work Location Type</FormLabel>
                <Select onValueChange={v => field.onChange(v === "none" ? "" : v)} value={field.value || "none"}>
                  <FormControl><SelectTrigger data-testid="select-work-location-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="on_site">On-site</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="otr">OTR</SelectItem>
                    <SelectItem value="field_based">Field-based</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Category</FormLabel>
                  <Select onValueChange={v => { field.onChange(v === "none" ? "" : v); form.setValue("subcategory", ""); }} value={field.value || "none"}>
                    <FormControl><SelectTrigger data-testid="select-job-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {taxonomyCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="subcategory" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory</FormLabel>
                  <Select onValueChange={v => field.onChange(v === "none" ? "" : v)} value={field.value || "none"} disabled={!form.watch("category")}>
                    <FormControl><SelectTrigger data-testid="select-job-subcategory"><SelectValue placeholder="Select subcategory" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
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
                  <Select onValueChange={v => field.onChange(v === "none" ? "" : v)} value={field.value || "none"}>
                    <FormControl><SelectTrigger data-testid="select-job-industry"><SelectValue placeholder="Select industry" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
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
                  <FormControl><Input placeholder="$70,000 – $90,000" data-testid="input-job-salary" {...field} value={field.value ?? ""} /></FormControl>
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

interface ImportResult {
  runId: number;
  status: string;
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: number;
  hasErrors: boolean;
}

interface ImportRunRecord {
  id: number;
  employerId: number;
  uploadedBy: number;
  uploadedAt: string;
  filename: string | null;
  rowsTotal: number | null;
  rowsImported: number | null;
  rowsSkipped: number | null;
  status: string;
}

interface UploadedLogo { companyName: string; logoUrl: string; employerId: number; }

function UploadJobsTab({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  // Logo upload state
  const [logoCompanyName, setLogoCompanyName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploadedLogos, setUploadedLogos] = useState<UploadedLogo[]>([]);

  const { data: importHistory = [], isLoading: historyLoading } = useQuery<ImportRunRecord[]>({
    queryKey: ["/api/admin/jobs/import/runs"],
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLastResult(null);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/jobs/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Import failed");
        setImporting(false);
        e.target.value = "";
        return;
      }

      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs/import/runs"] });
      toast({
        title: data.status === "Completed"
          ? `Successfully imported ${data.rowsImported} jobs!`
          : `Imported ${data.rowsImported} of ${data.rowsTotal} jobs (${data.rowsSkipped} skipped)`,
      });
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) { setLogoError("Please select an image file."); return; }
    if (!logoCompanyName.trim()) { setLogoError("Please enter a company name."); return; }
    setLogoUploading(true);
    setLogoError(null);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      formData.append("companyName", logoCompanyName.trim());
      const res = await fetch("/api/admin/employer-logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setLogoError(data.message || "Logo upload failed"); return; }
      setUploadedLogos(prev => [{ companyName: data.companyName, logoUrl: data.logoUrl, employerId: data.employerId }, ...prev]);
      setLogoCompanyName("");
      setLogoFile(null);
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: `Logo uploaded for ${data.companyName}` });
    } catch (err: any) {
      setLogoError(err.message || "Upload failed");
    } finally {
      setLogoUploading(false);
    }
  };

  const sampleCsv = `externalJobKey,title,companyName,jobType,category,subcategory,industry,locationCity,locationState,locationCountry,workLocationType,description,coreResponsibilities,requirements,benefits,salaryMin,salaryMax,salaryUnit,experienceLevel,skills,keywords,applyUrl
CDL-001,CDL Class A Driver,Fast Trucking Co.,Full-time,Drivers (CDL & Non-CDL),CDL A Driver (OTR),Trucking,Chicago,IL,USA,otr,"Long haul driver needed","Drive routes; maintain logs","CDL Class A; 3+ years","Health insurance; 401k",70000,90000,year,Mid-level,"CDL,long haul,freight","trucking,driver",
DISP-001,Fleet Dispatcher,Metro Logistics,Contract,"Ground Transportation Ops (Dispatch, Planning, Fleet)",Dispatcher,Logistics,Atlanta,GA,USA,on_site,"Manage driver schedules","Schedule routes; coordinate","2+ years dispatching","PTO; remote",55000,65000,year,Entry-level,"dispatching,routing","logistics,dispatch",https://example.com/apply`;

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lanelogicjobs-import-sample.csv";
    a.click();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-2xl font-bold font-display" data-testid="text-upload-heading">Upload Jobs via CSV</h2>
          <p className="text-muted-foreground mt-1">Import multiple job listings at once. Valid rows are upserted by external key; invalid rows are skipped.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadSample} data-testid="button-download-sample">
          <Download size={15} className="mr-2" /> Sample CSV
        </Button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 mb-6">
        <p className="font-semibold mb-1">Required columns:</p>
        <code className="text-xs">externalJobKey, title, description, requirements</code>
        <p className="mt-1">Optional: <code className="text-xs">companyName, jobType, category, subcategory, industry, locationCity, locationState, locationCountry, workLocationType (remote | hybrid | on_site | otr | field_based), coreResponsibilities, benefits, salaryMin, salaryMax, salaryUnit, experienceLevelYears (0-2 | 2-5 | 5-10 | 10+), skills, keywords, applyUrl</code></p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-8 mb-6">
        <div className="border-2 border-dashed border-border rounded-xl py-10 text-center mb-0">
          <Upload className="mx-auto mb-3 text-muted-foreground" size={36} />
          <p className="font-semibold mb-1">{importing ? "Importing..." : "Drop your CSV file here or click to browse"}</p>
          <p className="text-sm text-muted-foreground mb-4">UTF-8 encoded .csv files only</p>
          <Label htmlFor="csv-jobs-upload" className="cursor-pointer">
            <Button asChild variant="outline" disabled={importing}>
              <span data-testid="button-choose-csv">{importing ? "Processing..." : "Choose CSV File"}</span>
            </Button>
          </Label>
          <Input id="csv-jobs-upload" type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="input-csv-upload" />
        </div>
      </div>

      {/* ── Company Logo Upload ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-muted-foreground" />
          <h3 className="font-semibold text-base">Company Logo Upload</h3>
          <span className="text-xs text-muted-foreground">(optional — attach a logo to any company by name)</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Logo file picker */}
          <Label htmlFor="logo-file-input" className="cursor-pointer shrink-0">
            <div
              className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors overflow-hidden"
              data-testid="logo-dropzone"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="preview" className="w-full h-full object-contain rounded-xl" />
              ) : (
                <>
                  <ImageIcon size={28} />
                  <span className="text-[10px] mt-1 text-center leading-tight">Click to<br/>choose logo</span>
                </>
              )}
            </div>
            <Input
              id="logo-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFileSelect}
              data-testid="input-logo-file"
            />
          </Label>

          {/* Company name + upload button */}
          <div className="flex-1 flex flex-col gap-3">
            <div>
              <Label htmlFor="logo-company-name" className="text-sm mb-1 block">Company Name</Label>
              <Input
                id="logo-company-name"
                placeholder="e.g. Fast Trucking Co."
                value={logoCompanyName}
                onChange={(e) => setLogoCompanyName(e.target.value)}
                data-testid="input-logo-company-name"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleLogoUpload}
                disabled={logoUploading || !logoFile || !logoCompanyName.trim()}
                data-testid="button-upload-logo"
              >
                {logoUploading ? "Uploading..." : "Upload Logo"}
              </Button>
              {logoFile && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); setLogoError(null); }}
                  data-testid="button-clear-logo"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {logoError && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600 dark:text-red-400" data-testid="alert-logo-error">
            <AlertCircle size={15} /> {logoError}
          </div>
        )}

        {uploadedLogos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Uploaded this session</p>
            <div className="flex flex-wrap gap-3">
              {uploadedLogos.map((ul, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5" data-testid={`uploaded-logo-${i}`}>
                  <img src={ul.logoUrl} alt={ul.companyName} className="w-6 h-6 object-contain rounded" />
                  <span className="text-sm font-medium">{ul.companyName}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 mb-6" data-testid="alert-import-error">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {lastResult && (
        <div className={`rounded-xl border p-5 mb-6 ${lastResult.status === "Completed" ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"}`} data-testid="section-import-result">
          <div className="flex items-center gap-2 mb-3">
            {lastResult.status === "Completed" ? (
              <CheckCircle2 className="text-green-600" size={20} />
            ) : (
              <AlertCircle className="text-amber-600" size={20} />
            )}
            <p className="font-semibold" data-testid="text-import-status">{lastResult.status}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
            <div>
              <p className="text-muted-foreground">Total Rows</p>
              <p className="font-semibold text-lg" data-testid="text-rows-total">{lastResult.rowsTotal}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Imported</p>
              <p className="font-semibold text-lg text-green-700 dark:text-green-400" data-testid="text-rows-imported">{lastResult.rowsImported}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Skipped</p>
              <p className="font-semibold text-lg text-red-700 dark:text-red-400" data-testid="text-rows-skipped">{lastResult.rowsSkipped}</p>
            </div>
          </div>
          {lastResult.hasErrors && (
            <a
              href={`/api/admin/jobs/import/${lastResult.runId}/error-report`}
              download
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              data-testid="link-download-error-report"
            >
              <Download size={14} /> Download Error Report
            </a>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold font-display mb-3" data-testid="text-import-history-heading">Import History</h3>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : importHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-imports">No imports yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {importHistory.map((run) => (
              <div key={run.id} className="bg-white dark:bg-slate-900 rounded-lg border border-border p-4 text-sm flex items-center justify-between" data-testid={`row-import-run-${run.id}`}>
                <div>
                  <p className="font-semibold">{run.filename || "Unknown file"}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(run.uploadedAt).toLocaleDateString()} · {run.rowsImported ?? 0} imported · {run.rowsSkipped ?? 0} skipped
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={run.status === "Completed" ? "default" : run.status === "Failed" ? "destructive" : "secondary"} data-testid={`badge-status-${run.id}`}>
                    {run.status}
                  </Badge>
                  {(run.rowsSkipped ?? 0) > 0 && (
                    <a
                      href={`/api/admin/jobs/import/${run.id}/error-report`}
                      download
                      className="text-primary hover:underline text-xs"
                      data-testid={`link-error-report-${run.id}`}
                    >
                      Errors
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "", isPublished: false as boolean, imageUrl: "" });
  const [shareBlog, setShareBlog] = useState<BlogPost | null>(null);

  const blogCats = (categories || []).filter(c => c.type === "blog");

  const form = useForm<z.infer<typeof blogFormSchema>>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: { title: "", content: "", category: "", imageUrl: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: z.infer<typeof blogFormSchema>) =>
      apiRequest("POST", "/api/blog", { ...values, authorId: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      form.reset();
      setShowForm(false);
      toast({ title: "Post created!" });
    },
    onError: () => toast({ title: "Error", description: "Could not create post.", variant: "destructive" }),
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
    setEditForm({ title: p.title, content: p.content, category: p.category || "", isPublished: p.isPublished ?? false, imageUrl: p.imageUrl || "" });
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
              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <ImageUpload value={field.value || ""} onChange={field.onChange} data-testid="image-blog-cover" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content *</FormLabel>
                  <FormControl>
                    <RichTextEditor value={field.value || ""} onChange={field.onChange} />
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
                {post.imageUrl && (
                  <img src={post.imageUrl} alt={post.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold font-display text-lg">{post.title}</h3>
                    {post.category && <Badge variant="outline" className="text-xs">{post.category}</Badge>}
                    {!post.isPublished && <Badge variant="secondary" className="text-xs" data-testid={`badge-draft-blog-${post.id}`}>Draft</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(post)} data-testid={`button-edit-blog-${post.id}`}><Pencil size={15} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareBlog(post)} data-testid={`button-share-blog-${post.id}`}><Share2 size={15} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this post?")) deleteMutation.mutate(post.id); }} data-testid={`button-delete-blog-${post.id}`}><Trash2 size={15} /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editPost} onOpenChange={() => setEditPost(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
            <div>
              <Label>Cover Image</Label>
              <ImageUpload value={editForm.imageUrl || ""} onChange={v => setEditForm(f => ({ ...f, imageUrl: v }))} data-testid="image-edit-blog-cover" />
            </div>
            <div>
              <Label className="mb-2 block">Content</Label>
              <RichTextEditor value={editForm.content} onChange={v => setEditForm(f => ({ ...f, content: v }))} />
            </div>
            <div className="flex items-center justify-between py-2 px-1 border rounded-lg">
              <Label className="font-medium">Published</Label>
              <Switch
                checked={editForm.isPublished ?? false}
                onCheckedChange={v => setEditForm(f => ({ ...f, isPublished: v }))}
                data-testid="switch-blog-published"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={updateMutation.isPending} onClick={() => {
                if (!editPost) return;
                const updates: Record<string, any> = { ...editForm };
                if (updates.isPublished && !editPost.isPublished) updates.publishedAt = new Date().toISOString();
                if (!updates.isPublished && editPost.isPublished) updates.publishedAt = null;
                updateMutation.mutate({ id: editPost.id, ...updates });
              }} data-testid="button-save-edit-blog">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => { if (editPost) setShareBlog(editPost); }} data-testid="button-share-from-edit-blog">
                <Share2 size={15} className="mr-1.5" /> Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {shareBlog && (
        <ShareToSocialModal
          entityType="blog"
          entityId={shareBlog.id}
          entityTitle={shareBlog.title}
          isPublished={shareBlog.isPublished ?? false}
          isOpen={!!shareBlog}
          onClose={() => setShareBlog(null)}
        />
      )}
    </div>
  );
}

// ─── RESOURCES TAB ────────────────────────────────────────────────────────────

const resourceFormSchema = insertResourceSchema.extend({
  title: z.string().min(3, "Title required"),
  introText: z.string().optional(),
  bodyText: z.string().optional(),
});

function ResourcesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: resources, isLoading } = useQuery<Resource[]>({ queryKey: ["/api/resources"] });
  const [showForm, setShowForm] = useState(false);
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [editForm, setEditForm] = useState({ title: "", introText: "", bodyText: "", targetAudience: "both", requiredTier: "free", isPublished: false as boolean });
  const [shareResource, setShareResource] = useState<Resource | null>(null);

  const form = useForm<z.infer<typeof resourceFormSchema>>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { title: "", introText: "", bodyText: "", targetAudience: "both", requiredTier: "free" },
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
    onError: (error: any) => {
      toast({ title: "Error updating resource", description: error.message, variant: "destructive" });
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
    setEditForm({ title: r.title, introText: r.introText || "", bodyText: r.bodyText || "", targetAudience: r.targetAudience, requiredTier: r.requiredTier, isPublished: r.isPublished ?? false });
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
              <FormField control={form.control} name="introText" render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Intro</FormLabel>
                  <FormControl><Textarea className="min-h-[80px]" data-testid="textarea-resource-intro" placeholder="Short preview shown on resource cards" {...field} /></FormControl>
                  <div className="text-xs text-muted-foreground mt-1">{(field.value || "").length} characters</div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bodyText" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Body</FormLabel>
                  <FormControl><Textarea className="min-h-[120px]" data-testid="textarea-resource-body" placeholder="Full resource content shown on the detail page" {...field} /></FormControl>
                  <div className="text-xs text-muted-foreground mt-1">{(field.value || "").length} characters</div>
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
                <p className="text-sm text-muted-foreground line-clamp-2">{r.introText || r.content || ""}</p>
                <div className="flex gap-2 mt-3">
                  <Badge variant="outline" className="text-xs capitalize">{r.targetAudience.replace("_", " ")}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{r.requiredTier} tier</Badge>
                  {!r.isPublished && <Badge variant="secondary" className="text-xs" data-testid={`badge-draft-resource-${r.id}`}>Draft</Badge>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} data-testid={`button-edit-resource-${r.id}`}><Pencil size={15} /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareResource(r)} data-testid={`button-share-resource-${r.id}`}><Share2 size={15} /></Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Resource</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div><Label>Title</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-resource-title" /></div>
              <div>
                <Label>Card Intro</Label>
                <Textarea value={editForm.introText} onChange={e => setEditForm(f => ({ ...f, introText: e.target.value }))} className="min-h-[80px]" data-testid="textarea-edit-resource-intro" placeholder="Short preview shown on resource cards" />
                <div className="text-xs text-muted-foreground mt-1">{editForm.introText.length} characters</div>
              </div>
              <div>
                <Label>Full Body</Label>
                <Textarea value={editForm.bodyText} onChange={e => setEditForm(f => ({ ...f, bodyText: e.target.value }))} className="min-h-[120px]" data-testid="textarea-edit-resource-body" placeholder="Full resource content shown on the detail page" />
                <div className="text-xs text-muted-foreground mt-1">{editForm.bodyText.length} characters</div>
              </div>
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
              <div className="flex items-center justify-between py-2 px-1 border rounded-lg">
                <Label className="font-medium">Published</Label>
                <Switch
                  checked={editForm.isPublished ?? false}
                  onCheckedChange={v => setEditForm(f => ({ ...f, isPublished: v }))}
                  data-testid="switch-resource-published"
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={updateMutation.isPending} onClick={() => {
                  if (!editResource) return;
                  const updates: Record<string, any> = { ...editForm };
                  if (updates.isPublished && !editResource.isPublished) updates.publishedAt = new Date().toISOString();
                  if (!updates.isPublished && editResource.isPublished) updates.publishedAt = null;
                  updateMutation.mutate({ id: editResource.id, ...updates });
                }} data-testid="button-save-edit-resource">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => { if (editResource) setShareResource(editResource); }} data-testid="button-share-from-edit-resource">
                  <Share2 size={15} className="mr-1.5" /> Share
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Preview</Label>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-border p-4 space-y-4">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Card Preview</span>
                  <div className="mt-2 bg-white dark:bg-slate-900 rounded-lg border border-border p-4">
                    <h4 className="font-bold text-sm mb-1">{editForm.title || "Untitled"}</h4>
                    <p className="text-xs text-muted-foreground" data-testid="text-admin-intro-preview">
                      {editForm.introText.length > INTRO_TRUNCATE_LENGTH ? editForm.introText.slice(0, INTRO_TRUNCATE_LENGTH).trimEnd() + "\u2026" : editForm.introText || "No intro text"}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Body Preview</span>
                  <div className="mt-2 bg-white dark:bg-slate-900 rounded-lg border border-border p-4 max-h-60 overflow-y-auto">
                    {editForm.bodyText ? editForm.bodyText.split("\n\n").map((para, i) => (
                      <p key={i} className="text-xs text-muted-foreground mb-2 last:mb-0">
                        {tokenize(para).map((token, j) =>
                          token.type === "url" ? (
                            <a key={j} href={token.value} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{token.value}</a>
                          ) : (
                            <span key={j}>{token.value}</span>
                          )
                        )}
                      </p>
                    )) : <p className="text-xs text-muted-foreground italic">No body text</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {shareResource && (
        <ShareToSocialModal
          entityType="resource"
          entityId={shareResource.id}
          entityTitle={shareResource.title}
          isPublished={shareResource.isPublished ?? false}
          isOpen={!!shareResource}
          onClose={() => setShareResource(null)}
        />
      )}
    </div>
  );
}

// ─── CATEGORIES TAB ──────────────────────────────────────────────────────────

function CategoriesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { taxonomy: liveTaxonomy, isLoading: taxonomyLoading } = useTaxonomy();

  // ── editable taxonomy state ────────────────────────────────────────────────
  const [localTaxonomy, setLocalTaxonomy] = useState<TaxonomyData>({});
  const [isDirty, setIsDirty] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState("");
  const [newSubInputs, setNewSubInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (liveTaxonomy && Object.keys(liveTaxonomy).length > 0 && !isDirty) {
      setLocalTaxonomy(Object.fromEntries(Object.entries(liveTaxonomy).map(([k, v]) => [k, [...v]])));
    }
  }, [liveTaxonomy]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/admin/taxonomy", { taxonomy: localTaxonomy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxonomy"] });
      setIsDirty(false);
      toast({ title: "Taxonomy saved", description: "Changes are now live across all job forms and filters." });
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const toggleCat = (cat: string) => setExpandedCats(prev => {
    const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next;
  });
  const expandAll = () => setExpandedCats(new Set(Object.keys(localTaxonomy)));
  const collapseAll = () => setExpandedCats(new Set());

  const addCategory = () => {
    const name = newCatName.trim();
    if (!name || name in localTaxonomy) return;
    setLocalTaxonomy(prev => ({ ...prev, [name]: [] }));
    setNewCatName("");
    setIsDirty(true);
  };

  const deleteCategory = (cat: string) => {
    setLocalTaxonomy(prev => { const next = { ...prev }; delete next[cat]; return next; });
    setIsDirty(true);
  };

  const addSubcategory = (cat: string) => {
    const sub = (newSubInputs[cat] || "").trim();
    if (!sub || (localTaxonomy[cat] || []).includes(sub)) return;
    setLocalTaxonomy(prev => ({ ...prev, [cat]: [...(prev[cat] || []), sub] }));
    setNewSubInputs(prev => ({ ...prev, [cat]: "" }));
    setIsDirty(true);
  };

  const deleteSubcategory = (cat: string, sub: string) => {
    setLocalTaxonomy(prev => ({ ...prev, [cat]: prev[cat].filter(s => s !== sub) }));
    setIsDirty(true);
  };

  // ── industry / blog categories (DB-backed) ─────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"industry" | "blog">("industry");
  const [csvUploading, setCsvUploading] = useState(false);

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

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const existing = new Set((categoriesData || []).map(c => `${c.type}:${c.name.toLowerCase()}`));
      let added = 0; let skipped = 0;
      for (const line of lines) {
        const parts = line.split(",").map(p => p.trim().replace(/^["']|["']$/g, ""));
        if (parts.length < 2) continue;
        const [name, type] = parts;
        if (!name || !["industry", "blog"].includes(type.toLowerCase())) continue;
        const normalizedType = type.toLowerCase() as "industry" | "blog";
        if (existing.has(`${normalizedType}:${name.toLowerCase()}`)) { skipped++; continue; }
        existing.add(`${normalizedType}:${name.toLowerCase()}`);
        await apiRequest("POST", "/api/categories", { name, type: normalizedType });
        added++;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: `Upload complete`, description: `${added} added, ${skipped} duplicates skipped.` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setCsvUploading(false);
      e.target.value = "";
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), type: newType });
  };

  if (categoriesLoading || taxonomyLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  const industries = (categoriesData || []).filter(c => c.type === "industry");
  const blogCats = (categoriesData || []).filter(c => c.type === "blog");

  const renderEditableSection = (title: string, type: "industry" | "blog", items: Category[]) => (
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
        <Button size="sm" disabled={createMutation.isPending || !newName.trim() || newType !== type}
          onClick={() => { setNewType(type); handleAdd(); }} data-testid={`button-add-${type}-category`}>
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Categories & Labels</h2>
          <p className="text-muted-foreground text-sm mt-1">Edit job taxonomy live — changes propagate to job forms and filters instantly after saving.</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-4 flex flex-col gap-2 max-w-sm">
          <p className="text-sm font-semibold">Bulk Upload via CSV</p>
          <p className="text-xs text-muted-foreground">CSV format: <code className="bg-muted px-1 rounded">name,type</code> — one per line. Type must be <code className="bg-muted px-1 rounded">industry</code> or <code className="bg-muted px-1 rounded">blog</code>. Duplicates are skipped.</p>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" data-testid="input-csv-categories" />
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors ${csvUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={14} /> {csvUploading ? "Uploading..." : "Choose CSV File"}
            </span>
          </label>
        </div>
      </div>
      <div className="space-y-6">
        {/* ── Editable Job Taxonomy ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6" data-testid="section-job-taxonomy">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold font-display text-lg">Job Categories</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{Object.keys(localTaxonomy).length} categories</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} data-testid="button-expand-all-taxonomy">Expand All</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} data-testid="button-collapse-all-taxonomy">Collapse All</Button>
              {isDirty && (
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-taxonomy">
                  {saveMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              )}
            </div>
          </div>

          {/* Add new category */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New category name…"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
              className="max-w-xs"
              data-testid="input-add-taxonomy-category"
            />
            <Button size="sm" onClick={addCategory} disabled={!newCatName.trim()} data-testid="button-add-taxonomy-category">
              <Plus size={16} /> Add Category
            </Button>
          </div>

          <div className="space-y-1">
            {Object.entries(localTaxonomy).map(([cat, subs]) => {
              const isOpen = expandedCats.has(cat);
              return (
                <div key={cat} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <button
                      onClick={() => toggleCat(cat)}
                      className="flex items-center gap-2 flex-1 text-left text-sm font-medium"
                      data-testid={`taxonomy-cat-${cat.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}
                    >
                      {isOpen ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                      <span>{cat}</span>
                      <Badge variant="outline" className="ml-1 text-xs">{subs.length}</Badge>
                    </button>
                    <button
                      onClick={() => deleteCategory(cat)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title={`Delete category "${cat}"`}
                      data-testid={`button-delete-taxonomy-cat-${cat.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-2 border-t border-border bg-muted/30">
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {subs.map(sub => (
                          <Badge key={sub} variant="secondary" className="text-xs py-1 px-2.5 gap-1.5" data-testid={`taxonomy-sub-${sub.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}>
                            {sub}
                            <button onClick={() => deleteSubcategory(cat, sub)} className="hover:text-destructive" data-testid={`button-delete-sub-${sub.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}>
                              <X size={11} />
                            </button>
                          </Badge>
                        ))}
                        {subs.length === 0 && <p className="text-xs text-muted-foreground">No subcategories yet.</p>}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add subcategory…"
                          value={newSubInputs[cat] || ""}
                          onChange={e => setNewSubInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubcategory(cat); } }}
                          className="h-8 text-xs max-w-xs"
                          data-testid={`input-add-sub-${cat.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}
                        />
                        <Button size="sm" className="h-8 px-2" onClick={() => addSubcategory(cat)} disabled={!(newSubInputs[cat] || "").trim()}
                          data-testid={`button-add-sub-${cat.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}>
                          <Plus size={13} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isDirty && (
            <div className="mt-4 flex justify-end">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-taxonomy-bottom">
                {saveMutation.isPending ? "Saving…" : "Save Taxonomy Changes"}
              </Button>
            </div>
          )}
        </div>

        {renderEditableSection("Industries", "industry", industries)}
        {renderEditableSection("Blog Categories", "blog", blogCats)}
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

// ─── CUSTOM PAGES TAB ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function CustomPagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: allPages, isLoading } = useQuery<Page[]>({ queryKey: ["/api/pages"] });

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    seoTitle: "",
    metaDescription: "",
    isPublished: false,
  });

  const [autoSlug, setAutoSlug] = useState(true);

  const resetForm = () => {
    setFormData({ title: "", slug: "", content: "", seoTitle: "", metaDescription: "", isPublished: false });
    setAutoSlug(true);
    setEditingPage(null);
    setIsCreating(false);
  };

  const openEditor = (page?: Page) => {
    if (page) {
      setFormData({
        title: page.title,
        slug: page.slug,
        content: page.content,
        seoTitle: page.seoTitle || "",
        metaDescription: page.metaDescription || "",
        isPublished: page.isPublished,
      });
      setAutoSlug(false);
      setEditingPage(page);
      setIsCreating(false);
    } else {
      resetForm();
      setIsCreating(true);
    }
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: autoSlug ? slugify(title) : prev.slug,
    }));
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/pages", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Page created!", description: "Your new page is now live." });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not create page.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
      apiRequest("PUT", `/api/pages/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Page updated!", description: "Changes are now live." });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not update page.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Page deleted" });
      setDeleteConfirm(null);
    },
  });

  const handleSave = () => {
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast({ title: "Missing fields", description: "Title and slug are required.", variant: "destructive" });
      return;
    }
    if (editingPage) {
      updateMutation.mutate({ id: editingPage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isCreating || editingPage) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold font-display">{editingPage ? "Edit Page" : "Create New Page"}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {editingPage ? "Update this page's content and settings." : "Create a new SEO page for your site."}
            </p>
          </div>
          <Button variant="outline" onClick={resetForm} data-testid="button-back-to-pages">
            <X size={16} className="mr-2" /> Cancel
          </Button>
        </div>

        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-1 block">Page Title *</Label>
              <Input
                value={formData.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="About Us"
                data-testid="input-page-title"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">URL Slug *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Your page will be available at: <span className="font-mono text-primary">/{formData.slug || "your-slug"}</span>
              </p>
              <Input
                value={formData.slug}
                onChange={e => {
                  setAutoSlug(false);
                  setFormData(prev => ({ ...prev, slug: slugify(e.target.value) }));
                }}
                placeholder="about-us"
                data-testid="input-page-slug"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Page Content</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Use the visual editor to format your content, or switch to HTML mode for direct editing.
              </p>
              <RichTextEditor
                value={formData.content}
                onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 space-y-5">
            <h3 className="font-bold font-display text-lg flex items-center gap-2">
              <SearchIcon size={18} /> SEO Settings
            </h3>
            <div>
              <Label className="text-sm font-semibold mb-1 block">SEO Title</Label>
              <p className="text-xs text-muted-foreground mb-2">The title shown in search engine results. Defaults to the page title if empty.</p>
              <Input
                value={formData.seoTitle}
                onChange={e => setFormData(prev => ({ ...prev, seoTitle: e.target.value }))}
                placeholder="About Us | LaneLogic Jobs"
                data-testid="input-page-seo-title"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Meta Description</Label>
              <p className="text-xs text-muted-foreground mb-2">A brief description for search engine results (150-160 characters ideal).</p>
              <Textarea
                value={formData.metaDescription}
                onChange={e => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
                placeholder="Learn more about LaneLogic Jobs..."
                className="min-h-[80px] resize-none"
                data-testid="textarea-page-meta-description"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold block">Published</Label>
                <p className="text-xs text-muted-foreground mt-1">When off, the page is only visible to admins.</p>
              </div>
              <Switch
                checked={formData.isPublished}
                onCheckedChange={v => setFormData(prev => ({ ...prev, isPublished: v }))}
                data-testid="switch-page-published"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-border">
            {editingPage && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <a href={`/${editingPage.slug}`} target="_blank" rel="noopener noreferrer" data-testid="button-preview-page">
                  <ExternalLink size={14} /> Preview Live Page
                </a>
              </Button>
            )}
            <div className="ml-auto">
              <Button onClick={handleSave} disabled={isSaving} className="gap-2" data-testid="button-save-page">
                {isSaving ? "Saving..." : editingPage ? "Update Page" : "Create Page"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display">Custom Pages</h2>
          <p className="text-muted-foreground text-sm mt-1">Create and manage unlimited SEO pages for your site.</p>
        </div>
        <Button onClick={() => openEditor()} className="gap-2" data-testid="button-create-new-page">
          <Plus size={16} /> Create New Page
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 h-20 animate-pulse" />
          ))}
        </div>
      ) : !allPages || allPages.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
          <FilePlus2 className="mx-auto mb-4 text-muted-foreground" size={40} />
          <h3 className="text-lg font-bold font-display mb-2">No pages yet</h3>
          <p className="text-muted-foreground mb-4">Create your first custom page to get started.</p>
          <Button onClick={() => openEditor()} className="gap-2" data-testid="button-create-first-page">
            <Plus size={16} /> Create New Page
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {allPages.map(page => (
            <div
              key={page.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-5 flex items-center justify-between gap-4"
              data-testid={`page-row-${page.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold font-display text-base truncate">{page.title}</h3>
                  {!page.isPublished && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Draft</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe size={12} />
                    <span className="font-mono">/{page.slug}</span>
                  </span>
                  {page.updatedAt && (
                    <span>Updated {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" className="gap-1 text-xs" asChild>
                  <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer" data-testid={`button-view-page-${page.id}`}>
                    <Eye size={14} />
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => openEditor(page)} data-testid={`button-edit-page-${page.id}`}>
                  <Pencil size={14} />
                </Button>
                {deleteConfirm === page.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="destructive" size="sm" className="text-xs" onClick={() => deleteMutation.mutate(page.id)} data-testid={`button-confirm-delete-page-${page.id}`}>
                      Confirm
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setDeleteConfirm(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-red-500 hover:text-red-600" onClick={() => setDeleteConfirm(page.id)} data-testid={`button-delete-page-${page.id}`}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SITE PAGES TAB (Homepage / Login / Signup settings) ─────────────────────

function SitePagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: saved, isLoading } = useQuery<SiteSettingsData>({ queryKey: ["/api/settings"] });

  const [heroHidden, setHeroHidden] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({
    heroSize: "default", heroBadge: "", heroHeading: "", heroSubtext: "", heroPopularSearches: "", heroBgColor: "", heroBorderColor: "", heroFontColor: "",
    feature1Title: "", feature1Description: "",
    feature2Title: "", feature2Description: "",
    feature3Title: "", feature3Description: "",
    ctaHeading: "", ctaSubtext: "", ctaBackgroundImage: "",
    loginHeading: "", loginSubtitle: "",
    loginTestimonial: "", loginTestimonialAuthor: "", loginBackgroundImage: "", loginIconType: "truck",
    signupHeading: "", signupSubtitle: "", signupDescription: "", signupIconType: "truck",
  });

  useEffect(() => {
    if (saved) {
      setHeroHidden(saved.heroHidden ?? false);
      setDraft({
        heroSize: saved.heroSize ?? "default",
        heroBadge: saved.heroBadge ?? "",
        heroHeading: saved.heroHeading ?? "",
        heroSubtext: saved.heroSubtext ?? "",
        heroPopularSearches: saved.heroPopularSearches ?? "",
        heroBgColor: saved.heroBgColor ?? "",
        heroBorderColor: saved.heroBorderColor ?? "",
        heroFontColor: saved.heroFontColor ?? "",
        feature1Title: saved.feature1Title ?? "",
        feature1Description: saved.feature1Description ?? "",
        feature2Title: saved.feature2Title ?? "",
        feature2Description: saved.feature2Description ?? "",
        feature3Title: saved.feature3Title ?? "",
        feature3Description: saved.feature3Description ?? "",
        ctaHeading: saved.ctaHeading ?? "",
        ctaSubtext: saved.ctaSubtext ?? "",
        ctaBackgroundImage: saved.ctaBackgroundImage ?? "",
        loginHeading: saved.loginHeading ?? "",
        loginSubtitle: saved.loginSubtitle ?? "",
        loginTestimonial: saved.loginTestimonial ?? "",
        loginTestimonialAuthor: saved.loginTestimonialAuthor ?? "",
        loginBackgroundImage: saved.loginBackgroundImage ?? "",
        loginIconType: saved.loginIconType ?? "truck",
        signupHeading: saved.signupHeading ?? "",
        signupSubtitle: saved.signupSubtitle ?? "",
        signupDescription: saved.signupDescription ?? "",
        signupIconType: saved.signupIconType ?? "truck",
      });
    }
  }, [saved]);

  const updateMutation = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      apiRequest("PUT", "/api/settings", { ...saved, ...settings, heroHidden }).then(r => r.json()),
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
        <p className="text-muted-foreground text-sm mt-1">Customize the text and images on your Homepage, Login, and Signup pages.</p>
      </div>

      <div className="space-y-5">
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 ${heroHidden ? 'opacity-75' : ''}`}>
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <h3 className="font-bold font-display text-lg">Homepage — Hero Section</h3>
              <div className="flex items-center gap-2">
                <Switch checked={!heroHidden} onCheckedChange={(checked) => setHeroHidden(!checked)} data-testid="switch-hero-visibility" />
                <span className={`text-xs font-medium ${heroHidden ? 'text-red-500' : 'text-green-600'}`}>{heroHidden ? 'Hidden' : 'Visible'}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild data-testid="button-preview-homepage">
              <a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Preview Live Page</a>
            </Button>
          </div>
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-1 block">Hero Size</Label>
              <p className="text-xs text-muted-foreground mb-2">Controls the height and text size of the hero section.</p>
              <Select value={draft.heroSize} onValueChange={v => update("heroSize", v)}>
                <SelectTrigger data-testid="select-hero-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact — shorter padding, smaller text</SelectItem>
                  <SelectItem value="default">Default — standard size</SelectItem>
                  <SelectItem value="large">Large — more padding, bigger text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Badge Text</Label>
              <p className="text-xs text-muted-foreground mb-2">Small badge label above the main heading.</p>
              <Input value={draft.heroBadge} onChange={e => update("heroBadge", e.target.value)} placeholder="#1 Transportation Job Board" data-testid="input-hero-badge" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Heading</Label>
              <p className="text-xs text-muted-foreground mb-2">Main hero heading on the homepage.</p>
              <Input value={draft.heroHeading} onChange={e => update("heroHeading", e.target.value)} placeholder="Drive Your Career Forward" data-testid="input-hero-heading" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Subtext</Label>
              <p className="text-xs text-muted-foreground mb-2">Description text below the hero heading.</p>
              <Textarea value={draft.heroSubtext} onChange={e => update("heroSubtext", e.target.value)} placeholder="Connect with top employers in logistics..." className="min-h-[80px] resize-none" data-testid="textarea-hero-subtext" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Popular Searches</Label>
              <p className="text-xs text-muted-foreground mb-2">Comma-separated list of quick search links shown below the search bar. Leave empty to hide this section and shrink the hero.</p>
              <Input value={draft.heroPopularSearches} onChange={e => update("heroPopularSearches", e.target.value)} placeholder="CDL Driver, Logistics Manager, Dispatcher, Fleet Manager" data-testid="input-hero-popular-searches" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Background Color</Label>
                <p className="text-xs text-muted-foreground mb-2">Leave empty for default theme color.</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.heroBgColor || "#f8fafc"} onChange={e => update("heroBgColor", e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" data-testid="input-hero-bg-color" />
                  <Input value={draft.heroBgColor} onChange={e => update("heroBgColor", e.target.value)} placeholder="#f8fafc" className="flex-1" data-testid="input-hero-bg-color-text" />
                  {draft.heroBgColor && <Button variant="ghost" size="sm" onClick={() => update("heroBgColor", "")} className="text-xs px-2">Reset</Button>}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Bottom Border Color</Label>
                <p className="text-xs text-muted-foreground mb-2">Leave empty for no border.</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.heroBorderColor || "#e2e8f0"} onChange={e => update("heroBorderColor", e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" data-testid="input-hero-border-color" />
                  <Input value={draft.heroBorderColor} onChange={e => update("heroBorderColor", e.target.value)} placeholder="#e2e8f0" className="flex-1" data-testid="input-hero-border-color-text" />
                  {draft.heroBorderColor && <Button variant="ghost" size="sm" onClick={() => update("heroBorderColor", "")} className="text-xs px-2">Reset</Button>}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Font Color</Label>
                <p className="text-xs text-muted-foreground mb-2">Leave empty for default.</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.heroFontColor || "#0f172a"} onChange={e => update("heroFontColor", e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" data-testid="input-hero-font-color" />
                  <Input value={draft.heroFontColor} onChange={e => update("heroFontColor", e.target.value)} placeholder="#0f172a" className="flex-1" data-testid="input-hero-font-color-text" />
                  {draft.heroFontColor && <Button variant="ghost" size="sm" onClick={() => update("heroFontColor", "")} className="text-xs px-2">Reset</Button>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <h3 className="font-bold font-display text-lg">Homepage — Feature Cards</h3>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild data-testid="button-preview-homepage-features">
              <a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Preview Live Page</a>
            </Button>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-semibold mb-1 block">Feature 1 Title</Label><Input value={draft.feature1Title} onChange={e => update("feature1Title", e.target.value)} placeholder="10,000+ Active Jobs" data-testid="input-feature1-title" /></div>
              <div><Label className="text-sm font-semibold mb-1 block">Feature 1 Description</Label><Input value={draft.feature1Description} onChange={e => update("feature1Description", e.target.value)} placeholder="New opportunities added daily..." data-testid="input-feature1-desc" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-semibold mb-1 block">Feature 2 Title</Label><Input value={draft.feature2Title} onChange={e => update("feature2Title", e.target.value)} placeholder="Direct Employer Access" data-testid="input-feature2-title" /></div>
              <div><Label className="text-sm font-semibold mb-1 block">Feature 2 Description</Label><Input value={draft.feature2Description} onChange={e => update("feature2Description", e.target.value)} placeholder="Skip the middleman..." data-testid="input-feature2-desc" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm font-semibold mb-1 block">Feature 3 Title</Label><Input value={draft.feature3Title} onChange={e => update("feature3Title", e.target.value)} placeholder="Verified Companies" data-testid="input-feature3-title" /></div>
              <div><Label className="text-sm font-semibold mb-1 block">Feature 3 Description</Label><Input value={draft.feature3Description} onChange={e => update("feature3Description", e.target.value)} placeholder="Every employer is vetted..." data-testid="input-feature3-desc" /></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <h3 className="font-bold font-display text-lg">Homepage — Call to Action</h3>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild data-testid="button-preview-homepage-cta">
              <a href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Preview Live Page</a>
            </Button>
          </div>
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-1 block">CTA Heading</Label>
              <p className="text-xs text-muted-foreground mb-2">Heading for the bottom call-to-action section.</p>
              <Input value={draft.ctaHeading} onChange={e => update("ctaHeading", e.target.value)} placeholder="Ready to hire top transport talent?" data-testid="input-cta-heading" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">CTA Subtext</Label>
              <p className="text-xs text-muted-foreground mb-2">Supporting text below the CTA heading.</p>
              <Textarea value={draft.ctaSubtext} onChange={e => update("ctaSubtext", e.target.value)} placeholder="Join thousands of employers..." className="min-h-[80px] resize-none" data-testid="textarea-cta-subtext" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">CTA Background Image</Label>
              <p className="text-xs text-muted-foreground mb-2">Upload or paste a URL for the call-to-action background.</p>
              <ImageUpload value={draft.ctaBackgroundImage} onChange={v => update("ctaBackgroundImage", v)} data-testid="image-cta-background" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <h3 className="font-bold font-display text-lg">Login Page</h3>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild data-testid="button-preview-login">
              <a href="/login" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Preview Live Page</a>
            </Button>
          </div>
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
                placeholder="Great platform for finding qualified drivers..."
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
              <Label className="text-sm font-semibold mb-1 block">Background Image</Label>
              <p className="text-xs text-muted-foreground mb-2">Upload or paste a URL for the login page background.</p>
              <ImageUpload value={draft.loginBackgroundImage} onChange={v => update("loginBackgroundImage", v)} data-testid="image-login-background" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-1 block">Brand Icon</Label>
              <p className="text-xs text-muted-foreground mb-2">Icon shown next to the site name when no logo is uploaded. Choose "None" to hide.</p>
              <Select value={draft.loginIconType} onValueChange={v => update("loginIconType", v)}>
                <SelectTrigger data-testid="select-login-icon-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (hidden)</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="building">Building</SelectItem>
                  <SelectItem value="briefcase">Briefcase</SelectItem>
                  <SelectItem value="mappin">Map Pin</SelectItem>
                  <SelectItem value="shield">Shield</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="navigation">Navigation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <h3 className="font-bold font-display text-lg">Signup Page</h3>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild data-testid="button-preview-signup">
              <a href="/register" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Preview Live Page</a>
            </Button>
          </div>
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
                placeholder="Join us to take the next step"
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
            <div>
              <Label className="text-sm font-semibold mb-1 block">Side Panel Icon</Label>
              <p className="text-xs text-muted-foreground mb-2">Icon shown on the right side panel of the signup page. Choose "None" to hide.</p>
              <Select value={draft.signupIconType} onValueChange={v => update("signupIconType", v)}>
                <SelectTrigger data-testid="select-signup-icon-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (hidden)</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="building">Building</SelectItem>
                  <SelectItem value="briefcase">Briefcase</SelectItem>
                  <SelectItem value="mappin">Map Pin</SelectItem>
                  <SelectItem value="shield">Shield</SelectItem>
                  <SelectItem value="package">Package</SelectItem>
                  <SelectItem value="navigation">Navigation</SelectItem>
                </SelectContent>
              </Select>
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

// ─── FILTERED USERS TAB ──────────────────────────────────────────────────────

function FilteredUsersTab({ role }: { role: "job_seeker" | "employer" }) {
  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: jobs } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const { data: applications } = useQuery<import("@shared/schema").Application[]>({ queryKey: ["/api/applications"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", companyName: "", role: "", membershipTier: "" });

  const isEmployer = role === "employer";
  const label = isEmployer ? "Employer" : "Job Seeker";
  const labelPlural = isEmployer ? "Employer Users" : "Job Seeker Users";

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
    if (u.role !== role) return false;
    if (!search) return true;
    return `${u.email} ${u.firstName} ${u.lastName} ${u.companyName}`.toLowerCase().includes(search.toLowerCase());
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  if (showInvite) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => setShowInvite(false)} data-testid="button-back-to-users">
          <ArrowLeft size={14} className="mr-1.5" /> Back to {labelPlural}
        </Button>
        <InviteUserTab targetRole={role} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display" data-testid={`heading-${role}-users`}>{labelPlural} ({filtered.length})</h2>
        <div className="flex gap-3">
          <Button size="sm" onClick={() => setShowInvite(true)} data-testid={`button-invite-${role}`}>
            <UserPlus size={14} className="mr-1.5" /> Invite {label}
          </Button>
          <Input placeholder={`Search ${labelPlural.toLowerCase()}...`} className="w-64" value={search} onChange={e => setSearch(e.target.value)} data-testid={`input-${role}-search`} />
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Joined</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tier</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} data-testid={`row-${role}-user-${user.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium">{user.firstName} {user.lastName}{user.companyName && ` · ${user.companyName}`}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant="outline" className="capitalize text-xs">{user.membershipTier}</Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewUser(user)} data-testid={`button-view-${role}-user-${user.id}`}><Eye size={15} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)} data-testid={`button-edit-${role}-user-${user.id}`}><Pencil size={15} /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this user?")) deleteMutation.mutate(user.id); }} data-testid={`button-delete-${role}-user-${user.id}`}><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground">No {labelPlural.toLowerCase()} found.</div>}
      </div>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} /></div>
              <div><Label>Last Name</Label><Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} /></div>
            </div>
            <div><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            {isEmployer && <div><Label>Company Name</Label><Input value={editForm.companyName} onChange={e => setEditForm(f => ({ ...f, companyName: e.target.value }))} /></div>}
            <div>
              <Label>Membership Tier</Label>
              <Select value={editForm.membershipTier} onValueChange={v => setEditForm(f => ({ ...f, membershipTier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={updateMutation.isPending} onClick={() => editUser && updateMutation.mutate({ id: editUser.id, ...editForm })}>
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
                <div><p className="text-muted-foreground">Tier</p><Badge variant="outline" className="capitalize">{viewUser.membershipTier}</Badge></div>
                {viewUser.companyName && <div><p className="text-muted-foreground">Company</p><p className="font-medium">{viewUser.companyName}</p></div>}
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

// ─── EMAIL TEMPLATES TAB ─────────────────────────────────────────────────────

type EmailTemplate = {
  id: number;
  slug: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
  hasActiveTrigger?: boolean;
};

function EmailBodyEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editorProps: {
      attributes: {
        class: "min-h-[240px] p-3 text-sm font-mono leading-relaxed focus:outline-none whitespace-pre-wrap",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getText({ blockSeparator: "\n" }));
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getText({ blockSeparator: "\n" })) {
      editor.commands.setContent(value, false);
    }
  }, [value]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
      <EditorContent editor={editor} />
    </div>
  );
}

function EmailTemplatesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testCooldown, setTestCooldown] = useState(0);

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const selected = templates.find(t => t.slug === selectedSlug);

  useEffect(() => {
    if (selected) {
      setSubject(selected.subject);
      setBody(selected.body);
    }
  }, [selected?.slug]);

  useEffect(() => {
    if (testCooldown <= 0) return;
    const id = window.setInterval(() => setTestCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [testCooldown]);

  const saveMutation = useMutation({
    mutationFn: async ({ slug, isActive }: { slug: string; isActive?: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/email-templates/${slug}`, {
        subject,
        body,
        ...(isActive !== undefined ? { isActive } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Saved", description: "Template saved successfully." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ slug, isActive }: { slug: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/email-templates/${slug}`, { isActive });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] }),
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await apiRequest("POST", `/api/admin/email-templates/${slug}/test`, {});
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Send failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Test email sent", description: data.message });
      setTestCooldown(30);
    },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const insertVariable = (v: string) => {
    setBody(b => b + `{{${v}}}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        Loading email templates…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          <Mail size={20} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-display" data-testid="heading-email-templates">Email Templates</h2>
          <p className="text-sm text-muted-foreground">Manage transactional emails sent by LaneLogic Jobs.</p>
        </div>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        {/* Left: template list */}
        <div className="w-64 shrink-0 space-y-1">
          {templates.map(t => (
            <button
              key={t.slug}
              data-testid={`template-item-${t.slug}`}
              onClick={() => setSelectedSlug(t.slug)}
              className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
                selectedSlug === t.slug
                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{t.name}</span>
                {!t.hasActiveTrigger && (
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" title="No active trigger" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                <span className="text-xs text-muted-foreground">{t.isActive ? "Active" : "Inactive"}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right: editor */}
        {selected ? (
          <div className="flex-1 bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg" data-testid="text-template-name">{selected.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">slug: {selected.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selected.isActive ? "Active" : "Inactive"}</span>
                <button
                  data-testid={`toggle-active-${selected.slug}`}
                  onClick={() => toggleMutation.mutate({ slug: selected.slug, isActive: !selected.isActive })}
                  className="focus:outline-none"
                  aria-label="Toggle active"
                >
                  {selected.isActive
                    ? <ToggleRight size={28} className="text-green-500" />
                    : <ToggleLeft size={28} className="text-slate-400" />}
                </button>
              </div>
            </div>

            {!selected.hasActiveTrigger && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle size={15} />
                <span>This template has no active trigger — it will not send automatically.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject Line</Label>
              <Input
                id="email-subject"
                data-testid="input-email-subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject…"
              />
            </div>

            <div className="space-y-2">
              <Label>Body (plain text)</Label>
              <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">{"{{variable}}"}</code> tokens. Click a chip below to insert.</p>
              <EmailBodyEditor key={selected.slug} value={body} onChange={setBody} />
            </div>

            {selected.variables.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Available variables</Label>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map((v, i) => (
                    <button
                      key={`${v}-${i}`}
                      data-testid={`chip-var-${v}`}
                      onClick={() => insertVariable(v)}
                      className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Button
                data-testid="button-save-template"
                onClick={() => saveMutation.mutate({ slug: selected.slug })}
                disabled={saveMutation.isPending}
              >
                <Save size={15} className="mr-1.5" />
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                data-testid="button-test-send"
                onClick={() => testMutation.mutate(selected.slug)}
                disabled={testMutation.isPending || testCooldown > 0}
              >
                <Send size={15} className="mr-1.5" />
                {testCooldown > 0 ? `Wait ${testCooldown}s` : testMutation.isPending ? "Sending…" : "Send Test"}
              </Button>
              <p className="text-xs text-muted-foreground ml-auto">Test sends to your admin email.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-2xl">
            <div className="text-center space-y-2">
              <Mail size={32} className="mx-auto opacity-30" />
              <p className="text-sm">Select a template to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGES & RESOURCES LANDING ───────────────────────────────────────────────

function PagesResourcesTab() {
  const [, navigate] = useLocation();

  const sections = [
    {
      title: "Site Pages",
      description: "Manage the content of built-in pages like Home, About, Pricing, and Contact.",
      icon: FileEdit,
      path: "/dashboard/admin/site-pages",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Custom Pages",
      description: "Create and manage custom CMS pages with unique URLs and rich content.",
      icon: FilePlus2,
      path: "/dashboard/admin/custom-pages",
      color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
    },
    {
      title: "Resources",
      description: "Manage resource articles, guides, and downloadable content for users.",
      icon: BookOpen,
      path: "/dashboard/admin/resources",
      color: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-2" data-testid="heading-pages-resources">Pages & Resources</h2>
      <p className="text-muted-foreground mb-6">Manage your site's pages and resource content.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((s) => (
          <button
            key={s.path}
            onClick={() => navigate(s.path)}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 text-left hover:border-primary/40 hover:shadow-md transition-all group"
            data-testid={`card-${s.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>
              <s.icon size={24} />
            </div>
            <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── USERS LANDING TAB ────────────────────────────────────────────────────────

function UsersLandingTab() {
  const [, navigate] = useLocation();

  const sections = [
    {
      title: "All Users",
      description: "View and manage all registered users across every role.",
      icon: Users,
      path: "/dashboard/admin/users/all",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Job Seeker Users",
      description: "Browse and manage users registered as job seekers.",
      icon: UserCircle,
      path: "/dashboard/admin/users/job-seekers",
      color: "text-green-600 bg-green-50 dark:bg-green-900/20",
    },
    {
      title: "Employer Users",
      description: "Browse and manage users registered as employers.",
      icon: Briefcase,
      path: "/dashboard/admin/users/employers",
      color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-2" data-testid="heading-users">Users</h2>
      <p className="text-muted-foreground mb-6">Manage your platform's users by role.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((s) => (
          <button
            key={s.path}
            onClick={() => navigate(s.path)}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-border p-6 text-left hover:border-primary/40 hover:shadow-md transition-all group"
            data-testid={`card-${s.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>
              <s.icon size={24} />
            </div>
            <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ROOT EXPORT ──────────────────────────────────────────────────────────────

export default function AdminDashboard({ section, subsection }: { section?: string; subsection?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const content = () => {
    if (section === "users" && subsection === "all") return <UsersTab />;
    if (section === "users" && subsection === "job-seekers") return <FilteredUsersTab role="job_seeker" />;
    if (section === "users" && subsection === "employers") return <FilteredUsersTab role="employer" />;

    switch (section) {
      case "users": return <UsersLandingTab />;
      case "jobs": return <AllJobsTab />;
      case "post-job": return <PostJobTab userId={user.id} />;
      case "upload-jobs": return <UploadJobsTab userId={user.id} />;
      case "invite-seeker": return <InviteUserTab targetRole="job_seeker" />;
      case "invite-employer": return <InviteUserTab targetRole="employer" />;
      case "blog": return <BlogTab />;
      case "resources": return <ResourcesTab />;
      case "categories":
      case "database": return <CategoriesTab />;
      case "coupons": return <CouponsTab />;
      case "pages-resources": return <PagesResourcesTab />;
      case "site-pages": return <SitePagesTab />;
      case "custom-pages": return <CustomPagesTab />;
      case "social": return <SocialPublishing />;
      case "products": return <ProductManagement />;
      case "imports": return <ImportManagement />;
      case "employer-registry": return <EmployerRegistry />;
      case "verification": return <VerificationInbox />;
      case "seeker-verification": return <SeekerVerificationInbox />;
      case "email-templates": return <EmailTemplatesTab />;
      default: return <UsersLandingTab />;
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
