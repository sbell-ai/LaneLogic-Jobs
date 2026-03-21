import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Server, Database, Mail, Clock } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface SystemStatus {
  uptime: string;
  dbStatus: "ok" | "error";
  emailConfigured: boolean;
  cronLastRun: string | null;
  cronNextRun: string | null;
}

type StatusLevel = "green" | "amber" | "red";

function StatusDot({ level }: { level: StatusLevel }) {
  const colors: Record<StatusLevel, string> = {
    green: "bg-green-500",
    amber: "bg-amber-400",
    red: "bg-red-500",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${colors[level]}`} />;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function SystemStatusSection() {
  const { data: status, isLoading, refetch, isFetching } = useQuery<SystemStatus>({
    queryKey: ["/api/admin/system-status"],
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const items = status
    ? [
        {
          icon: <Server size={16} />,
          label: "Server Uptime",
          value: status.uptime,
          level: "green" as StatusLevel,
          testId: "status-server-uptime",
        },
        {
          icon: <Database size={16} />,
          label: "Database",
          value: status.dbStatus === "ok" ? "Connected" : "Connection error",
          level: (status.dbStatus === "ok" ? "green" : "red") as StatusLevel,
          testId: "status-database",
        },
        {
          icon: <Mail size={16} />,
          label: "Email Service",
          value: status.emailConfigured ? "Configured" : "Not configured",
          level: (status.emailConfigured ? "green" : "amber") as StatusLevel,
          testId: "status-email",
        },
        {
          icon: <Clock size={16} />,
          label: "Cron Engine",
          value: status.cronLastRun
            ? `Last run: ${formatDate(status.cronLastRun)} · Next: ${formatDate(status.cronNextRun)}`
            : status.cronNextRun
            ? `Next scheduled: ${formatDate(status.cronNextRun)}`
            : "No active cron configs",
          level: (status.cronLastRun ? "green" : "amber") as StatusLevel,
          testId: "status-cron",
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Live overview of core platform services.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 shrink-0"
          data-testid="button-refresh-status"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" data-testid="list-system-status">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))
            : items.map((item) => (
                <div key={item.label} className="flex items-start gap-3" data-testid={item.testId}>
                  <StatusDot level={item.level} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-muted-foreground">{item.icon}</span>
                      {item.label}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">{item.value}</p>
                  </div>
                </div>
              ))}
        </div>
      </CardContent>
    </Card>
  );
}
