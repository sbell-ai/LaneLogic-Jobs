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
import { Shield, Trash2, ScanLine } from "lucide-react";

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
  const [scanResult, setScanResult] = useState<{ scannedAt: string; message: string } | null>(null);

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
      toast({ title: "Scan complete", description: data.message });
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
                      <Input {...field} type="password" data-testid="input-current-password" />
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
                      <Input {...field} type="password" data-testid="input-new-password" />
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
                      <Input {...field} type="password" data-testid="input-confirm-password" />
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
        <CardContent className="space-y-3">
          {scanResult && (
            <div className="text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3" data-testid="text-scan-result">
              <p className="font-medium text-green-700 dark:text-green-300">{scanResult.message}</p>
              <p className="text-muted-foreground mt-0.5">Scanned at {formatDate(scanResult.scannedAt)}</p>
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
