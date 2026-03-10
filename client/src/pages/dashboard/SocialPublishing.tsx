import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Send, XCircle, Wifi, WifiOff, Zap, RotateCcw, Trash2 } from "lucide-react";
import { PLATFORM_LABELS } from "@shared/socialUtils";
import type { SocialPost } from "@shared/schema";
import { format } from "date-fns";

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "queued": return "default";
    case "sent": return "default";
    case "failed": return "destructive";
    case "canceled": return "outline";
    default: return "secondary";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "queued": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "sent": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "failed": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "canceled": return "";
    default: return "";
  }
}

function entityTypeBadgeColor(entityType: string): string {
  switch (entityType) {
    case "job": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "blog": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "resource": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
    default: return "";
  }
}

function SocialQueueTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (entityTypeFilter !== "all") queryParams.set("entityType", entityTypeFilter);
  const queryString = queryParams.toString();
  const endpoint = `/api/admin/social-posts${queryString ? `?${queryString}` : ""}`;

  const { data: posts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/api/admin/social-posts", statusFilter, entityTypeFilter],
    queryFn: async () => {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/social-posts/${id}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-posts"] });
      toast({ title: "Post re-queued" });
    },
    onError: (err: Error) => {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/social-posts/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-posts"] });
      toast({ title: "Post canceled" });
    },
    onError: (err: Error) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/social-posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-posts"] });
      toast({ title: "Post deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-entity-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="job">Jobs</SelectItem>
            <SelectItem value="blog">Blog</SelectItem>
            <SelectItem value="resource">Resources</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-muted-foreground" data-testid="text-empty-queue">
            No social posts found. Use the Share button on jobs, blog posts, or resources to create one.
          </p>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const platforms = (post.platforms as string[]) || [];
                return (
                  <TableRow key={post.id} data-testid={`row-social-post-${post.id}`}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {post.createdAt ? format(new Date(post.createdAt), "MMM d, yyyy h:mm a") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={entityTypeBadgeColor(post.entityType)} data-testid={`badge-entity-type-${post.id}`}>
                        {post.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium" data-testid={`text-title-${post.id}`}>
                      {post.titleSnapshot}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {platforms.map((p) => (
                          <Badge key={p} variant="outline" data-testid={`badge-platform-${post.id}-${p}`}>
                            {PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] || p}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {post.scheduledAt ? format(new Date(post.scheduledAt), "MMM d, h:mm a") : "Now"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusBadgeVariant(post.status)}
                        className={statusColor(post.status)}
                        data-testid={`badge-status-${post.id}`}
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground" data-testid={`text-sent-at-${post.id}`}>
                      {post.status === "sent" && post.updatedAt ? format(new Date(post.updatedAt), "MMM d, yyyy h:mm a") : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-destructive" data-testid={`text-error-${post.id}`}>
                      {post.lastError || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {post.status === "failed" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Retry"
                            onClick={() => retryMutation.mutate(post.id)}
                            disabled={retryMutation.isPending}
                            data-testid={`button-retry-${post.id}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {(post.status === "draft" || post.status === "queued") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Cancel"
                            onClick={() => cancelMutation.mutate(post.id)}
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-${post.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {post.status !== "sent" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this post?")) {
                                deleteMutation.mutate(post.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${post.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ConnectionsTab() {
  const { toast } = useToast();

  const { data: webhookStatus, isLoading: statusLoading } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/admin/social-posts/webhook-status"],
  });

  const [testResult, setTestResult] = useState<{ success: boolean; status?: number; error?: string; response?: any } | null>(null);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social-posts/test-webhook");
      return res.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast({ title: "Test payload sent successfully" });
      } else {
        toast({ title: "Test payload failed", description: data.error || `Status: ${data.status}`, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      setTestResult({ success: false, error: err.message });
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Zapier Webhook</h3>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2" data-testid="text-webhook-status">
            {statusLoading ? (
              <Skeleton className="h-4 w-4 rounded-full" />
            ) : webhookStatus?.configured ? (
              <>
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm">Webhook URL configured</span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Webhook URL not configured</span>
              </>
            )}
          </div>
        </div>

        <Button
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !webhookStatus?.configured}
          data-testid="button-test-webhook"
        >
          {testMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send Test Payload
        </Button>

        {testResult && (
          <div className="mt-4 p-4 rounded-md border" data-testid="text-test-result">
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">Test Successful</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-700 dark:text-red-400">Test Failed</span>
                </>
              )}
            </div>
            {testResult.status && (
              <p className="text-sm text-muted-foreground">HTTP Status: {testResult.status}</p>
            )}
            {testResult.error && (
              <p className="text-sm text-destructive">{testResult.error}</p>
            )}
            {testResult.response && (
              <pre className="mt-2 text-xs bg-muted p-2 rounded-md overflow-x-auto">
                {JSON.stringify(testResult.response, null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">How It Works</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Social posts are sent to Zapier via webhook. Zapier handles publishing to LinkedIn, Facebook, and Instagram.</p>
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Set <code className="bg-muted px-1 rounded">ZAPIER_SOCIAL_POST_WEBHOOK_URL</code> in your environment to connect.</span>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Set <code className="bg-muted px-1 rounded">ZAPIER_CALLBACK_SECRET</code> for the callback endpoint security.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function SocialPublishing() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-social-publishing-title">Social Publishing</h2>
        <p className="text-muted-foreground">Manage social media posts and integrations</p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList data-testid="tabs-social-publishing">
          <TabsTrigger value="queue" data-testid="tab-social-queue">Social Queue</TabsTrigger>
          <TabsTrigger value="connections" data-testid="tab-connections">Connections</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-4">
          <SocialQueueTab />
        </TabsContent>
        <TabsContent value="connections" className="mt-4">
          <ConnectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
