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

const categoryKeysLower = new Map<string, JobCategory>(
  (Object.keys(JOB_TAXONOMY) as JobCategory[]).map(k => [k.toLowerCase(), k])
);

const subcategoryLookup = new Map<string, Map<string, string>>();
for (const [cat, subs] of Object.entries(JOB_TAXONOMY)) {
  const subMap = new Map<string, string>();
  for (const sub of subs) {
    subMap.set(sub.toLowerCase(), sub);
  }
  subcategoryLookup.set(cat, subMap);
}

export function getCategories(): JobCategory[] {
  return Object.keys(JOB_TAXONOMY) as JobCategory[];
}

export function getSubcategories(category: string): readonly string[] {
  const normalized = categoryKeysLower.get(category.toLowerCase());
  if (!normalized) return [];
  return JOB_TAXONOMY[normalized];
}

export function isValidCategory(category: string): boolean {
  return categoryKeysLower.has(category.toLowerCase());
}

export function isValidSubcategory(category: string, subcategory: string): boolean {
  const normalized = categoryKeysLower.get(category.toLowerCase());
  if (!normalized) return false;
  const subMap = subcategoryLookup.get(normalized);
  return !!subMap?.has(subcategory.toLowerCase());
}

export function normalizeCategory(category: string): string | null {
  return categoryKeysLower.get(category.toLowerCase()) ?? null;
}

export function normalizeSubcategory(category: string, subcategory: string): string | null {
  const normalizedCat = categoryKeysLower.get(category.toLowerCase());
  if (!normalizedCat) return null;
  const subMap = subcategoryLookup.get(normalizedCat);
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
    return { valid: false, error: "Subcategory is required when category is set." };
  }
  if (!hasCat && hasSub) {
    return { valid: false, error: "Category is required when subcategory is set." };
  }

  if (!isValidCategory(category!)) {
    return { valid: false, error: `Invalid category: "${category}". Must be one of the 15 standard categories.` };
  }

  if (!isValidSubcategory(category!, subcategory!)) {
    return { valid: false, error: `Invalid subcategory "${subcategory}" for category "${category}".` };
  }

  return { valid: true };
}
