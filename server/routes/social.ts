import { Router } from "express";
import { storage } from "../storage";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";

const router = Router();

// Social Publishing endpoints
const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_SOCIAL_POST_WEBHOOK_URL;
const ZAPIER_CALLBACK_SECRET = process.env.ZAPIER_CALLBACK_SECRET;
const ZAPIER_PLATFORM_URLS: Record<string, string | undefined> = {
  twitter: process.env.ZAPIER_WEBHOOK_URL_TWITTER,
  facebook_page: process.env.ZAPIER_WEBHOOK_URL_FACEBOOK,
  linkedin: process.env.ZAPIER_WEBHOOK_URL_LINKEDIN,
};
const getPlatformWebhookUrl = (platform: string): string | undefined =>
  ZAPIER_PLATFORM_URLS[platform] || ZAPIER_WEBHOOK_URL;

router.get("/share/jobs/:id.png", async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job) return res.status(404).json({ message: "Not found" });

    const { checkShareable } = await import("../socialHelpers");
    const shareCheck = checkShareable("job", job);
    if (!shareCheck.shareable) return res.status(404).json({ message: "Not found" });

    const variantParam = (req.query.variant as string) || "og";
    const variant = variantParam === "square" ? "square" : "og";
    const width = variant === "square" ? 1080 : 1200;
    const height = variant === "square" ? 1080 : 628;

    const { buildJobShareCard } = await import("../shareTemplates/jobShareCard");
    const { renderShareImage, getCacheKey, getJobContentHash } = await import("../utils/renderShareImage");

    const contentHash = getJobContentHash(job);
    const cacheKey = getCacheKey(jobId, contentHash, variant);
    const template = buildJobShareCard(job, variant);
    const pngBuffer = await renderShareImage(template, width, height, cacheKey);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(pngBuffer);
  } catch (err: any) {
    console.error("Share image error:", err);
    res.status(500).json({ message: "Failed to generate share image" });
  }
});

router.get("/api/admin/social-posts/webhook-status", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const anyConfigured = !!(ZAPIER_WEBHOOK_URL || Object.values(ZAPIER_PLATFORM_URLS).some(Boolean));
  res.json({
    configured: anyConfigured,
    platforms: {
      twitter: !!ZAPIER_PLATFORM_URLS.twitter,
      facebook_page: !!ZAPIER_PLATFORM_URLS.facebook_page,
      linkedin: !!ZAPIER_PLATFORM_URLS.linkedin,
    },
    fallback: !!ZAPIER_WEBHOOK_URL,
  });
});

router.get("/api/admin/social-posts", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const filters: { status?: string; entityType?: string } = {};
  if (typeof req.query.status === "string") filters.status = req.query.status;
  if (typeof req.query.entityType === "string") filters.entityType = req.query.entityType;
  const posts = await storage.listSocialPosts(filters);
  res.json(posts);
});

router.post("/api/admin/social-posts", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const { entityType, entityId, platforms, scheduledAt, copyMaster, imageUrl } = req.body;
    let entity: any;
    if (entityType === "job") entity = await storage.getJob(entityId);
    else if (entityType === "blog") entity = await storage.getBlogPost(entityId);
    else if (entityType === "resource") entity = await storage.getResource(entityId);
    else return res.status(400).json({ message: "Invalid entityType" });

    if (!entity) return res.status(404).json({ message: "Entity not found" });

    const { checkShareable } = await import("../socialHelpers");
    const shareCheck = checkShareable(entityType, entity);
    if (!shareCheck.shareable) {
      const msg = entityType === "job" && shareCheck.errors.some(e => e.reason === "expired")
        ? "Only published, non-expired jobs can be shared to social."
        : "Only published items can be shared to social.";
      return res.status(409).json({ message: msg, errors: shareCheck.errors });
    }

    const { getPublicEntityUrl } = await import("../socialHelpers");
    const { buildLinkUrl, generateDefaultCopy } = await import("../../shared/socialUtils");
    const entityUrl = getPublicEntityUrl(entityType, entity);
    const linkUrl = buildLinkUrl(entityUrl);
    const titleSnapshot = entity.title;
    const defaultCopy = generateDefaultCopy(entityType, {
      title: entity.title,
      location: [entity.locationCity, entity.locationState, entity.locationCountry].filter(Boolean).join(", ") || undefined,
      salary: entity.salary || undefined,
      linkUrl,
      company: entity.companyName || undefined,
      jobType: entity.jobType || undefined,
    });

    const post = await storage.createSocialPost({
      entityType,
      entityId,
      entityUrl,
      titleSnapshot,
      imageUrl: imageUrl || null,
      linkUrl,
      platforms: platforms || ["linkedin"],
      status: "draft",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      copyMaster: copyMaster || null,
      copyByPlatform: defaultCopy,
      provider: "zapier",
      createdBy: (req.user as any).id,
    });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: "Failed to create social post" });
  }
});

router.patch("/api/admin/social-posts/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  try {
    const post = await storage.getSocialPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Social post not found" });

    const { platforms, scheduledAt, copyMaster, copyByPlatform, imageUrl } = req.body;
    const updates: any = {};
    if (platforms !== undefined) {
      if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ message: "At least one platform is required", errors: [{ field: "platforms", reason: "empty" }] });
      }
      updates.platforms = platforms;
    }
    if (scheduledAt !== undefined) updates.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (copyMaster !== undefined) updates.copyMaster = copyMaster;
    if (copyByPlatform !== undefined) updates.copyByPlatform = copyByPlatform;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    if (updates.copyByPlatform && updates.platforms) {
      const { validatePlatformCopy } = await import("../../shared/socialUtils");
      const copyErrors = validatePlatformCopy(updates.copyByPlatform, updates.platforms);
      if (copyErrors.length > 0) {
        return res.status(400).json({ message: copyErrors.join(" "), errors: copyErrors.map(e => ({ field: "copy", reason: e })) });
      }
    }

    const updated = await storage.updateSocialPost(Number(req.params.id), updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update social post" });
  }
});

async function queueSocialPost(postId: number, req: any, res: any) {
  const post = await storage.getSocialPost(postId);
  if (!post) return res.status(404).json({ message: "Social post not found" });
  if (post.status !== "draft" && post.status !== "failed") {
    return res.status(409).json({ message: `Cannot queue a post with status "${post.status}".` });
  }

  let entity: any;
  if (post.entityType === "job") entity = await storage.getJob(post.entityId);
  else if (post.entityType === "blog") entity = await storage.getBlogPost(post.entityId);
  else if (post.entityType === "resource") entity = await storage.getResource(post.entityId);

  if (!entity) return res.status(404).json({ message: "Original entity no longer exists" });

  const { checkShareable } = await import("../socialHelpers");
  const shareCheck = checkShareable(post.entityType, entity);
  if (!shareCheck.shareable) {
    const msg = post.entityType === "job" && shareCheck.errors.some(e => e.reason === "expired")
      ? "Only published, non-expired jobs can be shared to social."
      : "Only published items can be shared to social.";
    return res.status(409).json({ message: msg, errors: shareCheck.errors });
  }

  const platforms = post.platforms as string[];
  const copyByPlatform = (post.copyByPlatform || {}) as Record<string, string>;
  const copyMaster = post.copyMaster;
  const resolvedCopy: Record<string, string> = {};
  const missingCopy: string[] = [];

  const { generateDefaultCopy, buildLinkUrl } = await import("../../shared/socialUtils");
  const siteSettings = await storage.getSiteSettings();
  const siteName = (siteSettings as any).siteName || "LaneLogic Jobs";
  const { getBaseUrl } = await import("../socialHelpers");
  const baseUrl = getBaseUrl();
  const entityPath = post.entityType === "blog" ? "blog" : post.entityType === "job" ? "jobs" : "resources";
  const entityUrl = `${baseUrl}/${entityPath}/${post.entityId}`;
  const defaultCopy = generateDefaultCopy(post.entityType, {
    title: post.titleSnapshot || entity.title || "",
    location: [entity.locationCity, entity.locationState, entity.locationCountry].filter(Boolean).join(", ") || undefined,
    salary: entity.salary || undefined,
    linkUrl: buildLinkUrl(entityUrl),
    company: entity.companyName || undefined,
    jobType: entity.jobType || undefined,
  });

  for (const p of platforms) {
    if (copyByPlatform[p]) {
      resolvedCopy[p] = copyByPlatform[p];
    } else if (copyMaster) {
      resolvedCopy[p] = copyMaster;
    } else if (defaultCopy[p]) {
      resolvedCopy[p] = defaultCopy[p];
    } else {
      const { PLATFORM_LABELS } = await import("../../shared/socialUtils");
      const label = PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] || p;
      missingCopy.push(label);
    }
  }
  if (missingCopy.length > 0) {
    return res.status(400).json({
      message: `Missing copy for: ${missingCopy.join(", ")}. Provide platform-specific copy or a master copy.`,
      errors: missingCopy.map(p => ({ field: "copy", reason: `missing_${p}` })),
    });
  }

  const { validatePlatformCopy } = await import("../../shared/socialUtils");
  const copyErrors = validatePlatformCopy(resolvedCopy, platforms);
  if (copyErrors.length > 0) {
    return res.status(400).json({ message: copyErrors.join(" "), errors: copyErrors.map(e => ({ field: "copy", reason: e })) });
  }

  const unconfiguredPlatforms = platforms.filter(p => !getPlatformWebhookUrl(p));
  if (unconfiguredPlatforms.length > 0) {
    await storage.updateSocialPost(postId, { status: "failed", lastError: `No webhook URL configured for: ${unconfiguredPlatforms.join(", ")}` } as any);
    return res.status(500).json({ message: `No webhook URL configured for: ${unconfiguredPlatforms.join(", ")}` });
  }

  const locationParts = [entity.locationCity, entity.locationState, entity.locationCountry].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(", ") : null;

  const perPlatformResults: Array<{ platform: string; success: boolean; providerRequestId: string; error?: string; response?: any }> = [];

  for (const platform of platforms) {
    const webhookUrl = getPlatformWebhookUrl(platform)!;
    const providerRequestId = `${post.entityType}-${post.entityId}-${platform}`;
    const { getJobContentHash } = await import("../utils/renderShareImage");
    const contentHash = post.entityType === "job" ? getJobContentHash(entity) : "";
    const jobImageFields = post.entityType === "job" ? {
      imageUrl: `${baseUrl}/share/jobs/${post.entityId}.png?variant=og&v=${contentHash}`,
      imageUrlOg: `${baseUrl}/share/jobs/${post.entityId}.png?variant=og&v=${contentHash}`,
      imageUrlSquare: `${baseUrl}/share/jobs/${post.entityId}.png?variant=square&v=${contentHash}`,
    } : {
      imageUrl: post.imageUrl || null,
    };
    const payload = {
      providerRequestId,
      entityType: post.entityType,
      entityId: post.entityId,
      title: post.titleSnapshot || entity.title || "",
      company: entity.companyName || null,
      location,
      locationCity: entity.locationCity || null,
      locationState: entity.locationState || null,
      locationCountry: entity.locationCountry || null,
      jobType: entity.jobType || null,
      salary: entity.salary || null,
      url: `${baseUrl}/${entityPath}/${post.entityId}`,
      ...jobImageFields,
      platform,
      copy: resolvedCopy[platform],
      scheduledAt: post.scheduledAt,
    };
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json().catch(() => ({}));
      if (response.ok) {
        perPlatformResults.push({ platform, success: true, providerRequestId, response: responseData });
      } else {
        perPlatformResults.push({ platform, success: false, providerRequestId, error: `HTTP ${response.status}: ${JSON.stringify(responseData)}`, response: responseData });
      }
    } catch (err: any) {
      perPlatformResults.push({ platform, success: false, providerRequestId, error: err.message || "Network error" });
    }
  }

  const allSucceeded = perPlatformResults.every(r => r.success);
  const failedPlatforms = perPlatformResults.filter(r => !r.success).map(r => r.platform);
  const combinedProviderRequestId = perPlatformResults.map(r => r.providerRequestId).join(",");

  if (allSucceeded) {
    const updated = await storage.updateSocialPost(postId, {
      status: "sent",
      providerRequestId: combinedProviderRequestId,
      providerResponse: perPlatformResults,
    } as any);
    return res.json(updated);
  } else {
    await storage.updateSocialPost(postId, {
      status: "failed",
      lastError: `Failed to send to: ${failedPlatforms.join(", ")}`,
      providerRequestId: combinedProviderRequestId,
      providerResponse: perPlatformResults,
    } as any);
    return res.status(502).json({
      message: `Failed to send to: ${failedPlatforms.join(", ")}`,
      results: perPlatformResults,
    });
  }
}

router.post("/api/admin/social-posts/:id/queue", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  await queueSocialPost(Number(req.params.id), req, res);
});

router.post("/api/admin/social-posts/:id/retry", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const post = await storage.getSocialPost(Number(req.params.id));
  if (!post) return res.status(404).json({ message: "Social post not found" });
  if (post.status !== "failed") return res.status(409).json({ message: `Retry is only available for failed posts. Current status: "${post.status}".` });
  await queueSocialPost(Number(req.params.id), req, res);
});

router.post("/api/admin/social-posts/:id/cancel", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const post = await storage.getSocialPost(Number(req.params.id));
  if (!post) return res.status(404).json({ message: "Social post not found" });
  if (post.status !== "draft" && post.status !== "queued") {
    return res.status(409).json({ message: `Cannot cancel a post with status "${post.status}".` });
  }
  const updated = await storage.updateSocialPost(Number(req.params.id), { status: "canceled" } as any);
  res.json(updated);
});

router.delete("/api/admin/social-posts/:id", async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const post = await storage.getSocialPost(Number(req.params.id));
  if (!post) return res.status(404).json({ message: "Social post not found" });
  if (post.status === "sent") {
    return res.status(409).json({ message: "Cannot delete a post that has already been sent." });
  }
  await storage.deleteSocialPost(Number(req.params.id));
  res.json({ message: "Post deleted" });
});

router.post("/api/admin/social-posts/test-webhook", async (req, res) => {
  if (!requireAdminSession(req, res)) return;

  const PLATFORM_TEST_COPY: Record<string, string> = {
    twitter: "This is a test post from LaneLogic Jobs admin. [X/Twitter]",
    facebook_page: "This is a test post from LaneLogic Jobs admin. [Facebook]",
    linkedin: "This is a test post from LaneLogic Jobs admin. [LinkedIn]",
  };

  const platformResults: Record<string, { success: boolean; status?: number; error?: string; response?: any }> = {};
  let anyConfigured = false;

  for (const platform of Object.keys(ZAPIER_PLATFORM_URLS)) {
    const url = getPlatformWebhookUrl(platform);
    if (!url) {
      platformResults[platform] = { success: false, error: "Not configured" };
      continue;
    }
    anyConfigured = true;
    try {
      const testPayload = {
        test: true,
        providerRequestId: `test-0-${platform}`,
        entityType: "test",
        entityId: 0,
        title: "Test Post",
        company: "LaneLogic Jobs",
        location: null,
        url: "https://lanelogicjobs.com/test",
        imageUrl: null,
        platform,
        copy: PLATFORM_TEST_COPY[platform] || "This is a test post from LaneLogic Jobs admin.",
        scheduledAt: null,
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });
      const data = await response.json().catch(() => ({}));
      platformResults[platform] = { success: response.ok, status: response.status, response: data };
    } catch (err: any) {
      platformResults[platform] = { success: false, error: err.message || "Network error" };
    }
  }

  if (!anyConfigured) {
    return res.status(500).json({ success: false, message: "No webhook URLs configured", platforms: platformResults });
  }

  const allSucceeded = Object.values(platformResults).every(r => r.success);
  res.json({ success: allSucceeded, platforms: platformResults });
});

router.post("/api/integrations/zapier/social-posts/callback", async (req, res) => {
  const secret = req.headers["x-zapier-secret"];
  if (!ZAPIER_CALLBACK_SECRET || secret !== ZAPIER_CALLBACK_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const { providerRequestId, status, providerJobId, error, response: providerResp } = req.body;
    if (!providerRequestId) return res.status(400).json({ message: "providerRequestId required" });

    const allPosts = await storage.listSocialPosts();
    const post = allPosts.find(p => p.providerRequestId === providerRequestId);
    if (!post) return res.status(409).json({ message: "No matching social post for this providerRequestId" });

    const VALID_CALLBACK_STATUSES = ["sent", "failed", "canceled"];
    if (status && !VALID_CALLBACK_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Invalid status "${status}". Allowed: ${VALID_CALLBACK_STATUSES.join(", ")}` });
    }
    const updates: any = {};
    if (status) updates.status = status;
    if (providerJobId) updates.providerJobId = providerJobId;
    if (error) updates.lastError = error;
    if (providerResp) updates.providerResponse = providerResp;

    const updated = await storage.updateSocialPost(post.id, updates);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Callback processing failed" });
  }
});

export default router;
