const TAGGING_ARCH_ENABLED = process.env.TAGGING_ARCH_ENABLED === "true";

export interface TagValidationResult {
  valid: boolean;
  canonical: string[] | null;
  raw: string[];
  errors: { keyword: string; errorCode: string; errorMessage: string }[];
}

export function validateKeywords(keywords: string[]): TagValidationResult {
  const raw = keywords.map(k => k.trim()).filter(Boolean);

  if (!TAGGING_ARCH_ENABLED) {
    return { valid: true, canonical: null, raw, errors: [] };
  }

  const errors: { keyword: string; errorCode: string; errorMessage: string }[] = [];
  const canonical: string[] = [];

  for (const kw of raw) {
    const mapped = resolveCanonicalTag(kw);

    if (mapped.length === 0) {
      canonical.push(kw);
    } else if (mapped.length === 1) {
      canonical.push(mapped[0]);
    } else {
      errors.push({
        keyword: kw,
        errorCode: "AMBIGUOUS_KEYWORD",
        errorMessage: `Keyword "${kw}" maps to multiple canonical tags: ${mapped.join(", ")}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    canonical: errors.length === 0 ? canonical : null,
    raw,
    errors,
  };
}

function resolveCanonicalTag(_keyword: string): string[] {
  return [];
}
