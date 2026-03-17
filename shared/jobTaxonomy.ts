export const JOB_TAXONOMY = {
  "Leadership & Management": [
    "General Manager (Logistics / Transportation)",
    "Operations Director / Manager",
    "Supply Chain Director / Manager",
    "Terminal / Hub Manager",
    "Branch Manager",
    "Continuous Improvement Leader",
  ],
  "Freight Forwarding (Multimodal)": [
    "Forwarding Operations Specialist",
    "Import Coordinator",
    "Export Coordinator",
    "Documentation Specialist",
    "Trade Lane / Network Specialist",
    "Gateway Operations",
  ],
  "Customs & Trade Compliance": [
    "Licensed Customs Broker",
    "Entry Writer",
    "Trade Compliance Specialist",
    "Classification (HTS) Specialist",
    "Export Compliance (EAR/ITAR)",
    "Duty Drawback Specialist",
  ],
  "Air Cargo": [
    "Air Import Agent",
    "Air Export Agent",
    "Gateway / Air Cargo Operations",
    "ULD Build-up / Break-down",
    "Dangerous Goods (DGR) Specialist",
    "Cargo Security / Screening",
  ],
  "Ocean / Maritime Cargo": [
    "Ocean Import Coordinator",
    "Ocean Export Coordinator",
    "Port Operations Specialist",
    "Vessel Operations Coordinator",
    "Container / Equipment Controller",
    "Demurrage & Detention Analyst",
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
  "Freight Brokerage & 3PL": [
    "Freight Broker / Account Executive",
    "Carrier Sales Representative",
    "Customer Sales Representative",
    "Coverage / Capacity Specialist",
    "Carrier Procurement / Sourcing",
    "Brokerage Operations Specialist",
  ],
  "Intermodal & Rail": [
    "Intermodal Operations Coordinator",
    "Rail Logistics Coordinator",
    "Equipment / Chassis Manager",
    "Ramp Operations Coordinator",
  ],
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
  "Supply Chain Planning & Procurement": [
    "Demand Planner",
    "Supply Planner",
    "S&OP Analyst",
    "Buyer / Procurement Specialist",
    "Strategic Sourcing",
    "Vendor Management",
  ],
  "Customer Service & Account Management": [
    "Customer Service Representative (Logistics)",
    "Account Manager",
    "Client Success Manager",
    "Implementation / Onboarding Specialist",
    "Escalations / Service Recovery",
  ],
  "Sales & Business Development": [
    "Sales Development Rep (SDR)",
    "Business Development Manager",
    "Account Executive",
    "Solutions Consultant",
    "Partnerships Manager",
  ],
  "Pricing, Quoting & Rate Management": [
    "Quotation Specialist",
    "Pricing Analyst",
    "Rate Analyst",
    "Bid / RFP Manager",
    "Contract Pricing Manager",
  ],
  "Finance, Billing, Claims & Audit": [
    "Billing Specialist",
    "Freight Audit Analyst",
    "AP/AR Specialist",
    "Claims Specialist",
    "Revenue Assurance Analyst",
  ],
  "Other": [
    "Other",
  ],
} as const;

export type JobCategory = keyof typeof JOB_TAXONOMY;
export type TaxonomyData = Record<string, string[]>;

// ── Live (mutable) taxonomy ───────────────────────────────────────────────────
// Starts as the static default; overridden at runtime from the DB on the server
// and from the /api/taxonomy API response on the client via useTaxonomy().

let _liveTaxonomy: TaxonomyData = Object.fromEntries(
  Object.entries(JOB_TAXONOMY).map(([k, v]) => [k, [...v]])
);

function buildCategoryMap(t: TaxonomyData): Map<string, string> {
  return new Map(Object.keys(t).map(k => [k.toLowerCase(), k]));
}

function buildSubcategoryMap(t: TaxonomyData): Map<string, Map<string, string>> {
  const m = new Map<string, Map<string, string>>();
  for (const [cat, subs] of Object.entries(t)) {
    m.set(cat, new Map(subs.map(s => [s.toLowerCase(), s])));
  }
  return m;
}

let _categoryKeysLower = buildCategoryMap(_liveTaxonomy);
let _subcategoryLookup = buildSubcategoryMap(_liveTaxonomy);

export function getLiveTaxonomy(): TaxonomyData {
  return _liveTaxonomy;
}

export function setLiveTaxonomy(data: TaxonomyData): void {
  _liveTaxonomy = data;
  _categoryKeysLower = buildCategoryMap(data);
  _subcategoryLookup = buildSubcategoryMap(data);
}

// ── Public API functions (all use live taxonomy) ──────────────────────────────

export function getCategories(): string[] {
  return Object.keys(_liveTaxonomy);
}

export function getSubcategories(category: string): string[] {
  const normalized = _categoryKeysLower.get(category.toLowerCase());
  if (!normalized) return [];
  return _liveTaxonomy[normalized] ?? [];
}

export function isValidCategory(category: string): boolean {
  return _categoryKeysLower.has(category.toLowerCase());
}

export function isValidSubcategory(category: string, subcategory: string): boolean {
  const normalized = _categoryKeysLower.get(category.toLowerCase());
  if (!normalized) return false;
  const subMap = _subcategoryLookup.get(normalized);
  return !!subMap?.has(subcategory.toLowerCase());
}

export function normalizeCategory(category: string): string | null {
  return _categoryKeysLower.get(category.toLowerCase()) ?? null;
}

export function normalizeSubcategory(category: string, subcategory: string): string | null {
  const normalizedCat = _categoryKeysLower.get(category.toLowerCase());
  if (!normalizedCat) return null;
  const subMap = _subcategoryLookup.get(normalizedCat);
  return subMap?.get(subcategory.toLowerCase()) ?? null;
}

export function validateCategoryPair(
  category: string | null | undefined,
  subcategory: string | null | undefined
): { valid: boolean; error?: string } {
  const hasCat = !!category && category.trim().length > 0;
  const hasSub = !!subcategory && subcategory.trim().length > 0;

  if (!hasCat && !hasSub) return { valid: true };

  if (hasCat && !hasSub) {
    return { valid: true };
  }
  if (!hasCat && hasSub) {
    return { valid: false, error: "Category is required when subcategory is set." };
  }

  if (!isValidCategory(category!)) {
    return { valid: false, error: `Invalid category: "${category}".` };
  }

  if (!isValidSubcategory(category!, subcategory!)) {
    return { valid: false, error: `Invalid subcategory "${subcategory}" for category "${category}".` };
  }

  return { valid: true };
}
