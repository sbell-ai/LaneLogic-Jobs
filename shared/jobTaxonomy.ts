export const JOB_TAXONOMY = {
  "Trucking & Ground Transportation": {
    "Drivers (CDL & Non-CDL)": [
      "CDL A Driver (OTR)",
      "CDL A Driver (Regional)",
      "CDL A Driver (Local)",
      "CDL B Driver",
      "Yard Jockey / Spotter",
      "Box Truck / Straight Truck Driver",
      "Final Mile Delivery Driver",
      "Team Driver",
      "Owner-Operator",
    ],
    "Ground Transportation Ops (Dispatch, Planning, Fleet)": [
      "Dispatcher",
      "Load Planner",
      "Route Planner",
      "Drayage Coordinator",
      "Driver Manager",
      "Fleet / Transportation Manager",
      "Yard / Gate Coordinator",
    ],
    "Intermodal & Rail": [
      "Intermodal Operations Coordinator",
      "Rail Logistics Coordinator",
      "Equipment / Chassis Manager",
      "Ramp Operations Coordinator",
    ],
  },
  "Maritime & Port Operations": {
    "Ocean / Maritime Cargo": [
      "Ocean Import Coordinator",
      "Ocean Export Coordinator",
      "Port Operations Specialist",
      "Vessel Operations Coordinator",
      "Container / Equipment Controller",
      "Demurrage & Detention Analyst",
    ],
  },
  "Aviation & Air Cargo": {
    "Air Cargo": [
      "Air Import Agent",
      "Air Export Agent",
      "Gateway / Air Cargo Operations",
      "ULD Build-up / Break-down",
      "Dangerous Goods (DGR) Specialist",
      "Cargo Security / Screening",
    ],
  },
  "Freight Brokerage & 3PL": {
    "Freight Brokerage & 3PL": [
      "Freight Broker / Account Executive",
      "Carrier Sales Representative",
      "Customer Sales Representative",
      "Coverage / Capacity Specialist",
      "Carrier Procurement / Sourcing",
      "Brokerage Operations Specialist",
    ],
    "Freight Forwarding (Multimodal)": [
      "Forwarding Operations Specialist",
      "Import Coordinator",
      "Export Coordinator",
      "Documentation Specialist",
      "Trade Lane / Network Specialist",
      "Gateway Operations",
    ],
    "Pricing, Quoting & Rate Management": [
      "Quotation Specialist",
      "Pricing Analyst",
      "Rate Analyst",
      "Bid / RFP Manager",
      "Contract Pricing Manager",
    ],
  },
  "Supply Chain & Procurement": {
    "Supply Chain Planning & Procurement": [
      "Demand Planner",
      "Supply Planner",
      "S&OP Analyst",
      "Buyer / Procurement Specialist",
      "Strategic Sourcing",
      "Vendor Management",
    ],
    "Customs & Trade Compliance": [
      "Licensed Customs Broker",
      "Entry Writer",
      "Trade Compliance Specialist",
      "Classification (HTS) Specialist",
      "Export Compliance (EAR/ITAR)",
      "Duty Drawback Specialist",
    ],
  },
  "Warehousing & Distribution": {
    "Warehousing & Distribution (DC Ops)": [
      "Warehouse Associate",
      "Forklift Operator",
      "Receiving / Inbound",
      "Shipping / Outbound",
      "Inventory Control Specialist",
      "Cycle Counter",
      "Warehouse Supervisor",
      "DC Manager",
      "Returns / Reverse Logistics",
    ],
  },
  "General": {
    "Leadership & Management": [
      "General Manager (Logistics / Transportation)",
      "Operations Director / Manager",
      "Supply Chain Director / Manager",
      "Terminal / Hub Manager",
      "Branch Manager",
      "Continuous Improvement Leader",
    ],
    "Sales & Business Development": [
      "Sales Development Rep (SDR)",
      "Business Development Manager",
      "Account Executive",
      "Solutions Consultant",
      "Partnerships Manager",
    ],
    "Customer Service & Account Management": [
      "Customer Service Representative (Logistics)",
      "Account Manager",
      "Client Success Manager",
      "Implementation / Onboarding Specialist",
      "Escalations / Service Recovery",
    ],
    "Finance, Billing, Claims & Audit": [
      "Billing Specialist",
      "Freight Audit Analyst",
      "AP/AR Specialist",
      "Claims Specialist",
      "Revenue Assurance Analyst",
    ],
  },
  "Other": {
    "Other": ["Other"],
  },
} as const;

export type JobIndustry = keyof typeof JOB_TAXONOMY;
export type TaxonomyData = Record<string, Record<string, string[]>>;

// ── Live (mutable) taxonomy ───────────────────────────────────────────────────

let _liveTaxonomy: TaxonomyData = Object.fromEntries(
  Object.entries(JOB_TAXONOMY).map(([industry, cats]) => [
    industry,
    Object.fromEntries(Object.entries(cats).map(([cat, labels]) => [cat, [...labels]])),
  ])
);

function buildIndustryMap(t: TaxonomyData): Map<string, string> {
  return new Map(Object.keys(t).map(k => [k.toLowerCase(), k]));
}

function buildCategoryMap(t: TaxonomyData): Map<string, { industry: string; category: string }> {
  const m = new Map<string, { industry: string; category: string }>();
  for (const [industry, cats] of Object.entries(t)) {
    for (const cat of Object.keys(cats)) {
      m.set(cat.toLowerCase(), { industry, category: cat });
    }
  }
  return m;
}

function buildLabelMap(t: TaxonomyData): Map<string, Map<string, string>> {
  const m = new Map<string, Map<string, string>>();
  for (const cats of Object.values(t)) {
    for (const [cat, labels] of Object.entries(cats)) {
      m.set(cat, new Map((labels as string[]).map(s => [s.toLowerCase(), s])));
    }
  }
  return m;
}

let _industryKeysLower = buildIndustryMap(_liveTaxonomy);
let _categoryMap = buildCategoryMap(_liveTaxonomy);
let _labelMap = buildLabelMap(_liveTaxonomy);

export function getLiveTaxonomy(): TaxonomyData {
  return _liveTaxonomy;
}

export function setLiveTaxonomy(data: TaxonomyData): void {
  _liveTaxonomy = data;
  _industryKeysLower = buildIndustryMap(data);
  _categoryMap = buildCategoryMap(data);
  _labelMap = buildLabelMap(data);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getIndustries(): string[] {
  return Object.keys(_liveTaxonomy);
}

export function getCategories(industry?: string): string[] {
  if (industry) {
    const key = _industryKeysLower.get(industry.toLowerCase());
    return key ? Object.keys(_liveTaxonomy[key] ?? {}) : [];
  }
  return [..._categoryMap.values()].map(v => v.category);
}

/** @deprecated use getLabels(industry, category) */
export function getSubcategories(category: string): string[] {
  const entry = _categoryMap.get(category.toLowerCase());
  if (!entry) return [];
  return [...(_labelMap.get(entry.category)?.values() ?? [])];
}

export function getLabels(industry: string, category: string): string[] {
  const indKey = _industryKeysLower.get(industry.toLowerCase());
  if (!indKey) return [];
  return _liveTaxonomy[indKey]?.[category] ?? [];
}

/** All category names across all industries */
export function getAllCategories(): string[] {
  return [..._categoryMap.values()].map(v => v.category);
}

/** @deprecated use getIndustries() */
export function getCategories_deprecated(): string[] {
  return getIndustries();
}

export function isValidIndustry(industry: string): boolean {
  return _industryKeysLower.has(industry.toLowerCase());
}

export function isValidCategory(category: string): boolean {
  return _categoryMap.has(category.toLowerCase());
}

export function isValidSubcategory(category: string, subcategory: string): boolean {
  const entry = _categoryMap.get(category.toLowerCase());
  if (!entry) return false;
  return !!_labelMap.get(entry.category)?.has(subcategory.toLowerCase());
}

export function normalizeCategory(category: string): string | null {
  return _categoryMap.get(category.toLowerCase())?.category ?? null;
}

export function normalizeSubcategory(category: string, subcategory: string): string | null {
  const entry = _categoryMap.get(category.toLowerCase());
  if (!entry) return null;
  return _labelMap.get(entry.category)?.get(subcategory.toLowerCase()) ?? null;
}

export function getCategoryIndustry(category: string): string | null {
  return _categoryMap.get(category.toLowerCase())?.industry ?? null;
}

export function validateCategoryPair(
  category: string | null | undefined,
  subcategory: string | null | undefined
): { valid: boolean; error?: string } {
  const hasCat = !!category && category.trim().length > 0;
  const hasSub = !!subcategory && subcategory.trim().length > 0;

  if (!hasCat && !hasSub) return { valid: true };
  if (hasCat && !hasSub) return { valid: true };
  if (!hasCat && hasSub) {
    return { valid: false, error: "Category is required when label is set." };
  }

  if (!isValidCategory(category!)) {
    return { valid: false, error: `Invalid category: "${category}".` };
  }

  if (!isValidSubcategory(category!, subcategory!)) {
    return { valid: false, error: `Invalid label "${subcategory}" for category "${category}".` };
  }

  return { valid: true };
}

/** Detect if a stored taxonomy object is in the old 2-level format */
export function isLegacyTaxonomy(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  return Object.values(data as Record<string, unknown>).some(v => Array.isArray(v));
}
