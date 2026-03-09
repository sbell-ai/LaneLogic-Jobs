export function getPublicEntityUrl(entityType: string, entity: { id: number }): string {
  switch (entityType) {
    case "job":
      return `/jobs/${entity.id}`;
    case "blog":
      return `/blog/${entity.id}`;
    case "resource":
      return `/resources/${entity.id}`;
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
