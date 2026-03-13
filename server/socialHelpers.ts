export function getBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN || "";
  const domain = domains.split(",")[0]?.trim();
  if (domain) return `https://${domain}`;
  return "https://localhost:5000";
}

export function getPublicEntityUrl(entityType: string, entity: { id: number }): string {
  const base = getBaseUrl();
  switch (entityType) {
    case "job":
      return `${base}/jobs/${entity.id}`;
    case "blog":
      return `${base}/blog/${entity.id}`;
    case "resource":
      return `${base}/resources/${entity.id}`;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export function checkShareable(
  entityType: string,
  entity: { isPublished?: boolean; expiresAt?: Date | string | null }
): { shareable: boolean; errors: { field: string; reason: string }[] } {
  const errors: { field: string; reason: string }[] = [];

  if (!entity.isPublished) {
    errors.push({ field: "isPublished", reason: "not_published" });
  }

  if (entityType === "job" && entity.isPublished) {
    if (entity.expiresAt) {
      const expires = typeof entity.expiresAt === "string" ? new Date(entity.expiresAt) : entity.expiresAt;
      if (expires < new Date()) {
        errors.push({ field: "expiresAt", reason: "expired" });
      }
    }
  }

  return {
    shareable: errors.length === 0,
    errors,
  };
}
