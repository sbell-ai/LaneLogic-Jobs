import { useState } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Users, Briefcase, BookOpen, FileText, Plus, Trash2 } from "lucide-react";
import type { User, Job, Resource, BlogPost } from "@shared/schema";
import { insertResourceSchema, insertBlogPostSchema } from "@shared/schema";
import { z } from "zod";

function UsersTab() {
  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiRequest("PUT", `/api/users/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">All Users ({users?.length || 0})</h2>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-border">
            <tr>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">User</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Role</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Tier</th>
              <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(users || []).map((user) => (
              <tr key={user.id} data-testid={`row-user-${user.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium">{user.firstName} {user.lastName} {user.companyName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="capitalize">{user.role.replace("_", " ")}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge className={`capitalize ${
                    user.membershipTier === "premium" ? "bg-purple-100 text-purple-700 border-purple-200" :
                    user.membershipTier === "basic" ? "bg-blue-100 text-blue-700 border-blue-200" :
                    "bg-slate-100 text-slate-700 border-slate-200"
                  } border`}>
                    {user.membershipTier}
                  </Badge>
                </td>
                <td className="px-6 py-4">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobsTab() {
  const { data: jobs, isLoading } = useQuery<Job[]>({ queryKey: ["/api/jobs"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/jobs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <h2 className="text-2xl font-bold font-display mb-6">All Jobs ({jobs?.length || 0})</h2>
      <div className="space-y-3">
        {(jobs || []).map((job) => (
          <div key={job.id} data-testid={`card-admin-job-${job.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{job.title}</h3>
              <p className="text-sm text-muted-foreground">{job.location}{job.salary ? ` · ${job.salary}` : ""}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(job.id)}
              data-testid={`button-admin-delete-job-${job.id}`}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        <h2 className="text-2xl font-bold font-display">Resources ({resources?.length || 0})</h2>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-resource">
          <Plus size={16} className="mr-2" /> Add Resource
        </Button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6 mb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input data-testid="input-resource-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl><Textarea className="min-h-[100px]" data-testid="textarea-resource-content" {...field} /></FormControl>
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
              <div>
                <h3 className="font-semibold">{r.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.content}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs capitalize">{r.targetAudience.replace("_", " ")}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{r.requiredTier}</Badge>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const blogFormSchema = insertBlogPostSchema.omit({ authorId: true }).extend({
  title: z.string().min(3, "Title required"),
  content: z.string().min(20, "Content required"),
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
      toast({ title: "Blog post published!" });
    },
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-slate-100 dark:bg-slate-800 rounded-xl" />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-display">Blog Posts ({posts?.length || 0})</h2>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-blog-post">
          <Plus size={16} className="mr-2" /> New Post
        </Button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-6 mb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input data-testid="input-blog-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl><Textarea className="min-h-[200px]" data-testid="textarea-blog-content" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-publish-post">
                  {createMutation.isPending ? "Publishing..." : "Publish Post"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      <div className="space-y-3">
        {(posts || []).map((post) => (
          <div key={post.id} data-testid={`card-blog-admin-${post.id}`} className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5">
            <h3 className="font-semibold">{post.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard({ section }: { section?: string }) {
  const content = () => {
    if (section === "users") return <UsersTab />;
    if (section === "jobs") return <JobsTab />;
    if (section === "resources") return <ResourcesTab />;
    if (section === "blog") return <BlogTab />;
    return <UsersTab />;
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {content()}
      </div>
    </DashboardLayout>
  );
}
