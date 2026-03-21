import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, UserPlus, Clock, ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ADMIN_CAPABILITIES = [
  { id: "manage_users", label: "View and manage all users (job seekers, employers, and admins)" },
  { id: "manage_jobs", label: "Create, edit, and delete job listings" },
  { id: "manage_products", label: "Manage products and Stripe pricing" },
  { id: "manage_verification", label: "Approve or reject employer and seeker verification requests" },
  { id: "manage_imports", label: "Configure and run automated job import pipelines" },
  { id: "sync_registry", label: "Sync employer registry from Notion" },
  { id: "manage_content", label: "View and edit unpublished and expired jobs, resources, and blog posts" },
  { id: "manage_design", label: "Manage site design and branding settings" },
  { id: "manage_email", label: "Access and configure scheduled email automations and cron jobs" },
  { id: "admin_portal", label: "Admin portal access (all session-gated and secret-gated routes)" },
];

const ALL_CAPABILITY_IDS = ADMIN_CAPABILITIES.map((c) => c.id);

interface AdminUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  isActive: boolean;
  permissions: string[] | null;
}

interface InviteForm {
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
}

export default function PermissionsSection() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: "",
    firstName: "",
    lastName: "",
    permissions: [...ALL_CAPABILITY_IDS],
  });
  const [inviteResult, setInviteResult] = useState<{ tempPassword: string } | null>(null);

  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/admin-users"],
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/admin-users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      const res = await apiRequest("POST", "/api/admin/invite-admin", {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        permissions: data.permissions.length === ALL_CAPABILITY_IDS.length ? null : data.permissions,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setInviteResult({ tempPassword: data.tempPassword });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
    },
  });

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  function fullName(a: AdminUser) {
    return [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email;
  }

  function permissionsLabel(permissions: string[] | null) {
    if (!permissions) return { label: "Full access", count: ALL_CAPABILITY_IDS.length, full: true };
    return { label: `${permissions.length} of ${ALL_CAPABILITY_IDS.length}`, count: permissions.length, full: false };
  }

  function toggleCapability(id: string) {
    setInviteForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(id)
        ? prev.permissions.filter((p) => p !== id)
        : [...prev.permissions, id],
    }));
  }

  function selectAll() {
    setInviteForm((prev) => ({ ...prev, permissions: [...ALL_CAPABILITY_IDS] }));
  }

  function selectNone() {
    setInviteForm((prev) => ({ ...prev, permissions: [] }));
  }

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate(inviteForm);
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteForm({ email: "", firstName: "", lastName: "", permissions: [...ALL_CAPABILITY_IDS] });
    setInviteResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Permissions</CardTitle>
          <CardDescription>Capabilities granted to all admin-role accounts on this platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" data-testid="list-permissions">
            {ADMIN_CAPABILITIES.map((cap) => (
              <li key={cap.id} className="flex items-start gap-2 text-sm">
                <CheckCircle size={15} className="mt-0.5 text-green-500 shrink-0" />
                {cap.label}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Admin Users</CardTitle>
            <CardDescription>All accounts with admin role, their status, and last login.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)} className="flex items-center gap-2 shrink-0" data-testid="button-invite-admin">
            <UserPlus size={14} /> Invite Admin
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground" data-testid="text-admins-loading">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const perms = permissionsLabel(admin.permissions);
                  return (
                    <TableRow key={admin.id} data-testid={`row-admin-${admin.id}`}>
                      <TableCell className="font-medium">{fullName(admin)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{admin.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={admin.isActive ? "text-green-600 border-green-300" : "text-muted-foreground"}>
                          {admin.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(admin.lastLoginAt)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={perms.full ? "text-blue-600 border-blue-300 flex items-center gap-1 w-fit" : "text-amber-600 border-amber-300 flex items-center gap-1 w-fit"}
                          data-testid={`badge-permissions-${admin.id}`}
                        >
                          {perms.full ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
                          {perms.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {admin.id === (currentUser as any)?.id ? (
                          <Badge variant="secondary" data-testid="badge-your-role">Admin (you)</Badge>
                        ) : (
                          <Select
                            value={admin.role}
                            onValueChange={(role) => roleMutation.mutate({ id: admin.id, role })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs" data-testid={`select-role-${admin.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="employer">Employer</SelectItem>
                              <SelectItem value="job_seeker">Job Seeker</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) closeInvite(); else setInviteOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite New Admin</DialogTitle>
          </DialogHeader>
          {inviteResult ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded p-3" data-testid="text-invite-success">
                Admin account created. Share the temporary password securely.
              </p>
              <div>
                <Label>Temporary Password</Label>
                <Input readOnly value={inviteResult.tempPassword} className="font-mono mt-1" data-testid="text-temp-password" />
              </div>
              <DialogFooter>
                <Button onClick={closeInvite} data-testid="button-close-invite">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="invite-first">First Name</Label>
                  <Input
                    id="invite-first"
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm((p) => ({ ...p, firstName: e.target.value }))}
                    required
                    data-testid="input-invite-first-name"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-last">Last Name</Label>
                  <Input
                    id="invite-last"
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm((p) => ({ ...p, lastName: e.target.value }))}
                    required
                    data-testid="input-invite-last-name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  data-testid="input-invite-email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Permissions</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{inviteForm.permissions.length} of {ALL_CAPABILITY_IDS.length} selected</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectAll} data-testid="button-select-all-perms">All</Button>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={selectNone} data-testid="button-select-none-perms">None</Button>
                  </div>
                </div>
                <div className="border rounded-md p-3 space-y-2.5 max-h-52 overflow-y-auto" data-testid="list-invite-permissions">
                  {ADMIN_CAPABILITIES.map((cap) => (
                    <div key={cap.id} className="flex items-start gap-2.5">
                      <Checkbox
                        id={`perm-${cap.id}`}
                        checked={inviteForm.permissions.includes(cap.id)}
                        onCheckedChange={() => toggleCapability(cap.id)}
                        data-testid={`checkbox-perm-${cap.id}`}
                      />
                      <label htmlFor={`perm-${cap.id}`} className="text-sm leading-snug cursor-pointer select-none">
                        {cap.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeInvite} data-testid="button-cancel-invite">Cancel</Button>
                <Button type="submit" disabled={inviteMutation.isPending || inviteForm.permissions.length === 0} data-testid="button-submit-invite">
                  {inviteMutation.isPending ? "Inviting…" : "Send Invite"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
