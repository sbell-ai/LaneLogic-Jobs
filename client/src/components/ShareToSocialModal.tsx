import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  SUPPORTED_PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_CHAR_LIMITS,
  generateDefaultCopy,
  buildLinkUrl,
  type SocialPlatform,
} from "@shared/socialUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Send, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface ShareToSocialModalProps {
  entityType: string;
  entityId: number;
  entityTitle: string;
  isPublished: boolean;
  isExpired?: boolean;
  isOpen: boolean;
  onClose: () => void;
  entityLocation?: string;
  entitySalary?: string;
}

function getNextWholeHour(): string {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ShareToSocialModal({
  entityType,
  entityId,
  entityTitle,
  isPublished,
  isExpired = false,
  isOpen,
  onClose,
  entityLocation,
  entitySalary,
}: ShareToSocialModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    "linkedin",
  ]);
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(getNextWholeHour());
  const [copyByPlatform, setCopyByPlatform] = useState<
    Record<string, string>
  >({});
  const [activeTab, setActiveTab] = useState<string>("linkedin");
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const shareable = isPublished && !isExpired;

  useEffect(() => {
    if (isOpen) {
      setSelectedPlatforms(["linkedin"]);
      setUseSchedule(false);
      setScheduledAt(getNextWholeHour());
      setActiveTab("linkedin");
      setServerErrors([]);

      const entityPath = entityType === "blog" ? "blog" : entityType === "job" ? "jobs" : "resources";
      const entityUrl = `${window.location.origin}/${entityPath}/${entityId}`;
      const defaultCopy = generateDefaultCopy(entityType, {
        title: entityTitle,
        location: entityLocation,
        salary: entitySalary,
        linkUrl: buildLinkUrl(entityUrl),
      });
      setCopyByPlatform(defaultCopy);
    }
  }, [isOpen, entityType, entityId, entityTitle, entityLocation, entitySalary]);

  useEffect(() => {
    if (
      selectedPlatforms.length > 0 &&
      !selectedPlatforms.includes(activeTab as SocialPlatform)
    ) {
      setActiveTab(selectedPlatforms[0]);
    }
  }, [selectedPlatforms, activeTab]);

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const charErrors = useMemo(() => {
    const errs: string[] = [];
    for (const p of selectedPlatforms) {
      const copy = copyByPlatform[p];
      if (copy) {
        const limit = PLATFORM_CHAR_LIMITS[p];
        if (copy.length > limit) {
          errs.push(
            `${PLATFORM_LABELS[p]} copy is ${copy.length} characters (max ${limit}).`
          );
        }
      }
    }
    return errs;
  }, [copyByPlatform, selectedPlatforms]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social-posts", {
        entityType,
        entityId,
        platforms: selectedPlatforms,
      });
      return (await res.json()) as { id: number };
    },
  });

  const queueMutation = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/social-posts/${postId}`,
        {
          platforms: selectedPlatforms,
          copyByPlatform,
          scheduledAt: useSchedule ? new Date(scheduledAt).toISOString() : null,
        }
      );
      await res.json();

      const queueRes = await apiRequest(
        "POST",
        `/api/admin/social-posts/${postId}/queue`
      );
      return await queueRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-posts"] });
      toast({
        title: "Queued",
        description: (
          <span className="flex items-center gap-1 flex-wrap">
            Post queued for publishing.
            <button
              data-testid="link-view-social-queue"
              className="underline text-sm inline-flex items-center gap-1"
              onClick={() => {
                navigate("/dashboard/admin/social");
              }}
            >
              View in Social Queue <ExternalLink className="w-3 h-3" />
            </button>
          </span>
        ),
      });
      onClose();
    },
    onError: (error: Error) => {
      try {
        const parts = error.message.split(": ");
        const bodyStr = parts.slice(1).join(": ");
        const body = JSON.parse(bodyStr);
        if (body.errors && Array.isArray(body.errors)) {
          setServerErrors(
            body.errors.map(
              (e: { field?: string; reason?: string }) =>
                e.reason || e.field || "Unknown error"
            )
          );
        } else if (body.message) {
          setServerErrors([body.message]);
        } else {
          setServerErrors([error.message]);
        }
      } catch {
        setServerErrors([error.message]);
      }
    },
  });

  const handleSubmit = async () => {
    setServerErrors([]);
    if (selectedPlatforms.length === 0) {
      setServerErrors(["Select at least one platform."]);
      return;
    }
    if (charErrors.length > 0) {
      setServerErrors(charErrors);
      return;
    }

    try {
      const created = await createMutation.mutateAsync();
      await queueMutation.mutateAsync(created.id);
    } catch {
    }
  };

  const isPending = createMutation.isPending || queueMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-share-modal-title">
            Share: {entityTitle}
          </DialogTitle>
        </DialogHeader>

        {!isPublished && (
          <div
            className="flex items-start gap-2 p-3 rounded-md bg-muted"
            data-testid="text-publish-gate-message"
          >
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Publish this item to enable social sharing.
            </p>
          </div>
        )}

        {isPublished && isExpired && (
          <div
            className="flex items-start gap-2 p-3 rounded-md bg-muted"
            data-testid="text-expired-gate-message"
          >
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              This job is expired. Extend the expiration date to enable social
              sharing.
            </p>
          </div>
        )}

        {shareable && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Platforms
              </Label>
              <div className="flex flex-wrap gap-3">
                {SUPPORTED_PLATFORMS.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid={`checkbox-platform-${platform}`}
                  >
                    <Checkbox
                      checked={selectedPlatforms.includes(platform)}
                      onCheckedChange={() => togglePlatform(platform)}
                    />
                    <span className="text-sm">{PLATFORM_LABELS[platform]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Timing</Label>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant={!useSchedule ? "default" : "secondary"}
                  className="no-default-active-elevate"
                  data-testid="badge-post-now"
                >
                  {!useSchedule ? "Post now" : "Scheduled"}
                </Badge>
                <div className="flex items-center gap-2">
                  <Label htmlFor="schedule-toggle" className="text-sm">
                    Schedule
                  </Label>
                  <Switch
                    id="schedule-toggle"
                    checked={useSchedule}
                    onCheckedChange={setUseSchedule}
                    data-testid="switch-schedule"
                  />
                </div>
              </div>
              {useSchedule && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-2"
                  data-testid="input-scheduled-at"
                />
              )}
            </div>

            {selectedPlatforms.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Post Copy
                </Label>
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                >
                  <TabsList>
                    {selectedPlatforms.map((p) => (
                      <TabsTrigger
                        key={p}
                        value={p}
                        data-testid={`tab-copy-${p}`}
                      >
                        {PLATFORM_LABELS[p]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {selectedPlatforms.map((platform) => {
                    const copy = copyByPlatform[platform] || "";
                    const limit = PLATFORM_CHAR_LIMITS[platform];
                    const overLimit = copy.length > limit;
                    return (
                      <TabsContent key={platform} value={platform}>
                        <Textarea
                          placeholder={`Write your ${PLATFORM_LABELS[platform]} post copy...`}
                          value={copy}
                          onChange={(e) =>
                            setCopyByPlatform((prev) => ({
                              ...prev,
                              [platform]: e.target.value,
                            }))
                          }
                          rows={4}
                          className="resize-none"
                          data-testid={`textarea-copy-${platform}`}
                        />
                        <div
                          className={`text-xs mt-1 flex justify-end ${
                            overLimit
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                          data-testid={`text-char-count-${platform}`}
                        >
                          {copy.length} / {limit}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            )}

            <Card className="p-3">
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <p className="text-sm font-medium" data-testid="text-preview-title">
                {entityTitle}
              </p>
              <p
                className="text-xs text-muted-foreground mt-1"
                data-testid="text-preview-link"
              >
                /{entityType === "blog" ? "blog" : entityType === "job" ? "jobs" : "resources"}/{entityId}
              </p>
            </Card>

            {serverErrors.length > 0 && (
              <div
                className="p-3 rounded-md bg-destructive/10 text-destructive text-sm space-y-1"
                data-testid="text-server-errors"
              >
                {serverErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-share"
          >
            Cancel
          </Button>
          {shareable && (
            <Button
              onClick={handleSubmit}
              disabled={isPending || selectedPlatforms.length === 0}
              data-testid="button-queue-post"
            >
              {isPending ? (
                "Queueing..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" /> Queue Post
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
