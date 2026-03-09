export const SUPPORTED_PLATFORMS = ["linkedin", "facebook_page", "instagram_business"] as const;
export type SocialPlatform = typeof SUPPORTED_PLATFORMS[number];

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  linkedin: 3000,
  facebook_page: 2000,
  instagram_business: 2200,
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  facebook_page: "Facebook Page",
  instagram_business: "Instagram",
};

export function buildLinkUrl(entityUrl: string, platform?: string): string {
  const sep = entityUrl.includes("?") ? "&" : "?";
  let url = `${entityUrl}${sep}utm_source=social&utm_medium=organic&utm_campaign=admin_share`;
  if (platform) {
    url += `&utm_content=${encodeURIComponent(platform)}`;
  }
  return url;
}

export function generateDefaultCopy(
  entityType: string,
  data: { title: string; location?: string; salary?: string; linkUrl: string }
): Record<string, string> {
  const { title, location, salary, linkUrl } = data;

  if (entityType === "job") {
    const lines = {
      linkedin: [
        `Now hiring: ${title}`,
        location ? ` — ${location}` : "",
        salary ? `\nPay: ${salary}` : "",
        `\nApply: ${linkUrl}`,
      ],
      facebook_page: [
        `Hiring: ${title}`,
        location ? ` (${location})` : "",
        salary ? `\nPay: ${salary}` : "",
        `\nApply: ${linkUrl}`,
      ],
      instagram_business: [
        `Now hiring: ${title}`,
        location ? ` — ${location}` : "",
        salary ? `\nPay: ${salary}` : "",
        `\nApply: ${linkUrl}`,
      ],
    };
    return Object.fromEntries(
      Object.entries(lines).map(([p, parts]) => [p, parts.join("")])
    );
  }

  if (entityType === "blog") {
    const text = `${title}\nRead: ${linkUrl}`;
    return {
      linkedin: text,
      facebook_page: text,
      instagram_business: text,
    };
  }

  const text = `Free resource: ${title}\nGet it here: ${linkUrl}`;
  return {
    linkedin: text,
    facebook_page: text,
    instagram_business: text,
  };
}

export function validatePlatformCopy(
  copyByPlatform: Record<string, string>,
  platforms: string[]
): string[] {
  const errors: string[] = [];
  for (const platform of platforms) {
    const copy = copyByPlatform[platform];
    if (!copy || copy.trim().length === 0) {
      const label = PLATFORM_LABELS[platform as SocialPlatform] || platform;
      errors.push(`${label} copy is empty.`);
      continue;
    }
    const limit = PLATFORM_CHAR_LIMITS[platform as SocialPlatform];
    if (limit && copy.length > limit) {
      const label = PLATFORM_LABELS[platform as SocialPlatform] || platform;
      errors.push(`${label} copy is ${copy.length} characters (max ${limit}).`);
    }
  }
  return errors;
}
