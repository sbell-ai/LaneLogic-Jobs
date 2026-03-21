import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Trash2, ScanLine, Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface Session {
  sid: string;
  expire: string;
  isCurrent: boolean;
  ip: string | null;
  userAgent: string | null;
}

export default function SecuritySection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  type ScanCheck = { label: string; status: "ok" | "warning" | "error"; detail: string };
  type ScanResult = { scannedAt: string; checks: ScanCheck[]; issueCount: number; warningCount: number };
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showPasswords, setShowPasswords] = useState({ current: false, newPw: false, confirm: false });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/admin/sessions"],
  });

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const changePwMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await apiRequest("POST", "/api/admin/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (sid: string) => {
      await apiRequest("DELETE", `/api/admin/sessions/${sid}`);
    },
    onSuccess: () => {
      toast({ title: "Session revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to revoke", description: err.message, variant: "destructive" });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security-scan");
      return res.json();
    },
    onSuccess: (data) => {
      setScanResult(data);
      const issues = data.issueCount + data.warningCount;
      toast({
        title: "Scan complete",
        description: issues === 0 ? "All checks passed." : `${issues} issue${issues > 1 ? "s" : ""} found.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function parseUserAgent(ua: string | null) {
    if (!ua) return "Unknown device";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Safari")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return ua.slice(0, 40);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Requires your current password before setting a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => changePwMutation.mutate(d))} className="space-y-4 max-w-md">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type={showPasswords.current ? "text" : "password"} data-testid="input-current-password" className="pr-10" />
                        <button type="button" onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="toggle-current-password" tabIndex={-1}>
                          {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type={showPasswords.newPw ? "text" : "password"} data-testid="input-new-password" className="pr-10" />
                        <button type="button" onClick={() => setShowPasswords(s => ({ ...s, newPw: !s.newPw }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="toggle-new-password" tabIndex={-1}>
                          {showPasswords.newPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input {...field} type={showPasswords.confirm ? "text" : "password"} data-testid="input-confirm-password" className="pr-10" />
                        <button type="button" onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="toggle-confirm-password" tabIndex={-1}>
                          {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={changePwMutation.isPending} data-testid="button-change-password">
                {changePwMutation.isPending ? "Updating…" : "Update Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>All devices currently signed in to your account. Revoke any session you don't recognize.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <p className="text-sm text-muted-foreground" data-testid="text-sessions-loading">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-sessions">No active sessions found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device / Browser</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.sid} data-testid={`row-session-${session.sid.slice(0, 8)}`}>
                    <TableCell className="text-sm">{parseUserAgent(session.userAgent)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{session.ip ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(session.expire)}</TableCell>
                    <TableCell>
                      {session.isCurrent ? (
                        <Badge variant="outline" className="text-green-600 border-green-300" data-testid={`badge-current-session`}>Current</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeMutation.mutate(session.sid)}
                          disabled={revokeMutation.isPending}
                          className="text-red-500 hover:text-red-700"
                          data-testid={`button-revoke-session-${session.sid.slice(0, 8)}`}
                        >
                          <Trash2 size={14} className="mr-1" /> Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={18} /> Security Scan
          </CardTitle>
          <CardDescription>Run a manual security check on your admin account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scanMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-scan-running">
              <Loader2 size={15} className="animate-spin" />
              Running security checks…
            </div>
          )}
          {scanResult && !scanMutation.isPending && (
            <div className="space-y-2" data-testid="text-scan-result">
              <div className="divide-y divide-border border rounded-lg overflow-hidden">
                {scanResult.checks.map((check) => (
                  <div key={check.label} className="flex items-start gap-3 px-4 py-3 bg-card">
                    {check.status === "ok" && <CheckCircle2 size={16} className="mt-0.5 text-green-500 shrink-0" />}
                    {check.status === "warning" && <AlertTriangle size={16} className="mt-0.5 text-amber-500 shrink-0" />}
                    {check.status === "error" && <XCircle size={16} className="mt-0.5 text-red-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{check.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  {scanResult.issueCount === 0 && scanResult.warningCount === 0
                    ? "All checks passed"
                    : `${scanResult.warningCount} warning${scanResult.warningCount !== 1 ? "s" : ""}, ${scanResult.issueCount} error${scanResult.issueCount !== 1 ? "s" : ""}`}
                </span>
                <span>Scanned {formatDate(scanResult.scannedAt)}</span>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-run-scan"
          >
            <ScanLine size={15} />
            {scanMutation.isPending ? "Scanning…" : "Run Security Scan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
