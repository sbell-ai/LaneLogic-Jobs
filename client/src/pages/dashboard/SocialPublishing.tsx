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

type WebhookStatus = {
  configured: boolean;
  fallback: boolean;
  platforms: { twitter: boolean; facebook_page: boolean; linkedin: boolean };
};

type TestResult = {
  success: boolean;
  platforms?: Record<string, { success: boolean; status?: number; error?: string; response?: any }>;
  error?: string;
};

const PLATFORM_ENV_VARS: Record<string, string> = {
  twitter: "ZAPIER_WEBHOOK_URL_TWITTER",
  facebook_page: "ZAPIER_WEBHOOK_URL_FACEBOOK",
  linkedin: "ZAPIER_WEBHOOK_URL_LINKEDIN",
};

function PlatformStatusRow({ platform, specific, fallback }: { platform: string; specific: boolean; fallback: boolean }) {
  const active = specific || fallback;
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`text-platform-status-${platform}`}>
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-green-500" : "bg-red-400"}`} />
        <span className="text-sm font-medium">{PLATFORM_LABELS[platform] ?? platform}</span>
        {!specific && fallback && (
          <span className="text-xs text-muted-foreground">(using fallback)</span>
        )}
      </div>
      <code className="text-xs text-muted-foreground">{PLATFORM_ENV_VARS[platform]}</code>
    </div>
  );
}

function ConnectionsTab() {
  const { toast } = useToast();

  const { data: webhookStatus, isLoading: statusLoading } = useQuery<WebhookStatus>({
    queryKey: ["/api/admin/social-posts/webhook-status"],
  });

  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social-posts/test-webhook");
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast({ title: "All test payloads sent successfully" });
      } else {
        toast({ title: "One or more test payloads failed", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      setTestResult({ success: false, error: err.message });
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const platforms = webhookStatus?.platforms;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-1">Platform Webhooks</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Each platform can have its own Zapier webhook URL. If a platform-specific URL is not set, the fallback URL is used.
        </p>

        <div className="mb-4" data-testid="text-webhook-status">
          {statusLoading ? (
            <div className="space-y-2">
              {["twitter", "facebook_page", "linkedin"].map(p => (
                <Skeleton key={p} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : (
            <div className="divide-y rounded-md border px-4">
              {(["twitter", "facebook_page", "linkedin"] as const).map(p => (
                <PlatformStatusRow
                  key={p}
                  platform={p}
                  specific={!!platforms?.[p]}
                  fallback={!!webhookStatus?.fallback}
                />
              ))}
            </div>
          )}
          {!statusLoading && webhookStatus?.fallback && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Fallback: <code className="bg-muted px-1 rounded">ZAPIER_SOCIAL_POST_WEBHOOK_URL</code> is set
            </p>
          )}
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
          Send Test Payloads
        </Button>

        {testResult && (
          <div className="mt-4 p-4 rounded-md border" data-testid="text-test-result">
            <div className="flex items-center gap-2 mb-3">
              {testResult.success ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">All Tests Successful</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-700 dark:text-red-400">One or More Tests Failed</span>
                </>
              )}
            </div>
            {testResult.error && (
              <p className="text-sm text-destructive mb-2">{testResult.error}</p>
            )}
            {testResult.platforms && (
              <div className="space-y-2">
                {Object.entries(testResult.platforms).map(([platform, result]) => (
                  <div key={platform} className="flex items-start gap-2 text-sm" data-testid={`text-test-result-${platform}`}>
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${result.success ? "bg-green-500" : "bg-red-400"}`} />
                    <div>
                      <span className="font-medium">{PLATFORM_LABELS[platform] ?? platform}:</span>{" "}
                      {result.success ? (
                        <span className="text-muted-foreground">OK {result.status ? `(${result.status})` : ""}</span>
                      ) : (
                        <span className="text-destructive">{result.error ?? `HTTP ${result.status}`}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">How It Works</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>When a post is shared to multiple platforms, a separate webhook is fired for each one — each with its own platform-specific copy and a unique <code className="bg-muted px-1 rounded">providerRequestId</code>.</p>
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Set per-platform env vars (<code className="bg-muted px-1 rounded">ZAPIER_WEBHOOK_URL_TWITTER</code>, etc.) or use <code className="bg-muted px-1 rounded">ZAPIER_SOCIAL_POST_WEBHOOK_URL</code> as a fallback for all platforms.</span>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Set <code className="bg-muted px-1 rounded">ZAPIER_CALLBACK_SECRET</code> to secure the Zapier callback endpoint.</span>
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
