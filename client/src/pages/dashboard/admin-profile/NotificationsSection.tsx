import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle } from "lucide-react";

const NOTIFICATION_TOGGLES = [
  { key: "new_job_posted", label: "New Job Posted", description: "Alert when a new job listing is created" },
  { key: "new_user_registered", label: "New User Registered", description: "Alert when a new account signs up" },
  { key: "system_alerts", label: "System Alerts", description: "Critical system warnings and errors" },
  { key: "cron_failures", label: "Cron Job Failures", description: "Alert when a scheduled email cron job fails" },
  { key: "security_alerts", label: "Security Alerts", description: "Suspicious login attempts or permission changes" },
];

const DEFAULT_PREFS: Record<string, boolean> = {
  new_job_posted: false,
  new_user_registered: false,
  system_alerts: true,
  cron_failures: true,
  security_alerts: true,
};

export default function NotificationsSection() {
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: prefs = DEFAULT_PREFS, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/admin/notification-preferences"],
  });

  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);

  useEffect(() => {
    setLocalPrefs({ ...DEFAULT_PREFS, ...prefs });
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: async (newPrefs: Record<string, boolean>) => {
      await apiRequest("PUT", "/api/admin/notification-preferences", newPrefs);
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    const updated = { ...localPrefs, [key]: value };
    setLocalPrefs(updated);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // 500ms debounce on save to avoid flooding the API on rapid toggling
    debounceRef.current = setTimeout(() => {
      saveMutation.mutate(updated);
    }, 500);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose which events send you email notifications. Changes save automatically.</CardDescription>
          </div>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium" data-testid="text-saved-indicator">
              <CheckCircle size={13} /> Saved
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5" data-testid="list-notification-toggles">
          {NOTIFICATION_TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor={`toggle-${toggle.key}`} className="font-medium cursor-pointer" data-testid={`label-toggle-${toggle.key}`}>
                  {toggle.label}
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">{toggle.description}</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-11 rounded-full" />
              ) : (
                <Switch
                  id={`toggle-${toggle.key}`}
                  checked={localPrefs[toggle.key] ?? false}
                  onCheckedChange={(val) => handleToggle(toggle.key, val)}
                  data-testid={`switch-${toggle.key}`}
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
