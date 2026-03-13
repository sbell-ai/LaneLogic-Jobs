export const SUPPORTED_PLATFORMS = ["linkedin", "facebook_page", "instagram_business", "twitter"] as const;
export type SocialPlatform = typeof SUPPORTED_PLATFORMS[number];

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  linkedin: 3000,
  facebook_page: 2000,
  instagram_business: 2200,
  twitter: 280,
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  facebook_page: "Facebook Page",
  instagram_business: "Instagram",
  twitter: "X / Twitter",
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
  data: { title: string; location?: string; salary?: string; linkUrl: string; company?: string; jobType?: string }
): Record<string, string> {
  const { title, location, salary, linkUrl, company, jobType } = data;

  if (entityType === "job") {
    const lines: string[] = [title];
    if (company) lines.push(company);
    if (location || jobType || salary) lines.push("");
    if (location) lines.push(location);
    if (jobType) lines.push(jobType);
    if (salary) lines.push(salary);
    const text = lines.join("\n");
    return {
      linkedin: text,
      facebook_page: text,
      instagram_business: text,
      twitter: text,
    };
  }

  if (entityType === "blog") {
    const text = `${title}\nRead: ${linkUrl}`;
    return {
      linkedin: text,
      facebook_page: text,
      instagram_business: text,
      twitter: text,
    };
  }

  const text = `Free resource: ${title}\nGet it here: ${linkUrl}`;
  return {
    linkedin: text,
    facebook_page: text,
    instagram_business: text,
    twitter: text,
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
