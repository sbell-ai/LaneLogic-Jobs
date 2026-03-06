import { Client } from "@notionhq/client";

const NOTION_DB_IDS = {
  productsPricing: "3154caed-dabf-803d-a6a8-cc7b8f17b80a",
  featuresEntitlements: "23d7f753-a0d1-48bc-be8f-7cb3e9706956",
  productEntitlementOverrides: "90052bfc-79c9-418d-98b2-41b295be9dad",
  complianceRules: "37c447b4-7e93-4939-961e-2f82c158e41f",
} as const;

export type ProductRow = {
  notionPageId: string;
  productName: string;
  audience: string;
  billingCycle: string;
  planType: string;
  price: number;
  stripeProductId: string;
  stripePriceId: string;
  trialDays: number;
  logicKey: string;
  status: string;
  entitlementPageIds: string[];
  quotaSource: string;
  activeInstruction: string;
};

export type EntitlementRow = {
  notionPageId: string;
  entitlementName: string;
  entitlementKey: string;
  type: string;
  unit: string;
  defaultValue: string;
  status: string;
};

export type OverrideRow = {
  notionPageId: string;
  overrideName: string;
  productPageId: string;
  entitlementPageId: string;
  value: number | null;
  isUnlimited: boolean;
  enabled: boolean;
  status: string;
  notes: string;
};

export type ComplianceRuleRow = {
  notionPageId: string;
  ruleName: string;
  category: string;
  appliesTo: string;
  enforcement: string;
  jurisdiction: string;
  requirements: string;
  implementationNotes: string;
  status: string;
  effectiveDate: string;
  sourceLink: string;
};

export type ProductsPricingSnapshot = {
  registry: "products_pricing";
  generatedAt: string;
  rows: ProductRow[];
};

export type FeaturesEntitlementsSnapshot = {
  registry: "features_entitlements";
  generatedAt: string;
  rows: EntitlementRow[];
};

export type ProductEntitlementOverridesSnapshot = {
  registry: "product_entitlement_overrides";
  generatedAt: string;
  rows: OverrideRow[];
};

export type ComplianceRulesSnapshot = {
  registry: "compliance_rules";
  generatedAt: string;
  rows: ComplianceRuleRow[];
};

function extractPageIdFromUrl(url: string): string {
  const cleaned = url.replace("https://www.notion.so/", "").replace(/-/g, "");
  const match = cleaned.match(/([a-f0-9]{32})$/);
  if (match) {
    const raw = match[1];
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }
  return url;
}

function resolveRelationPageIds(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => {
      if (typeof item === "object" && item !== null && "id" in item) {
        return [(item as { id: string }).id];
      }
      if (typeof item === "string") {
        return [extractPageIdFromUrl(item)];
      }
      return [];
    });
  }
  return [];
}

function getPropText(props: Record<string, any>, key: string): string {
  const prop = props[key];
  if (!prop) return "";
  if (prop.type === "title") {
    return (prop.title ?? []).map((t: any) => t.plain_text ?? "").join("");
  }
  if (prop.type === "rich_text") {
    return (prop.rich_text ?? []).map((t: any) => t.plain_text ?? "").join("");
  }
  return "";
}

function getPropSelect(props: Record<string, any>, key: string): string {
  const prop = props[key];
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name ?? "";
  if (prop.type === "status") return prop.status?.name ?? "";
  return "";
}

function getPropNumber(props: Record<string, any>, key: string): number {
  const prop = props[key];
  if (!prop || prop.type !== "number") return 0;
  return prop.number ?? 0;
}

function getPropCheckbox(props: Record<string, any>, key: string): boolean {
  const prop = props[key];
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox ?? false;
}

function getPropRelation(props: Record<string, any>, key: string): string[] {
  const prop = props[key];
  if (!prop || prop.type !== "relation") return [];
  return (prop.relation ?? []).map((r: any) => r.id as string);
}

function getPropUrl(props: Record<string, any>, key: string): string {
  const prop = props[key];
  if (!prop || prop.type !== "url") return "";
  return prop.url ?? "";
}

function getPropDate(props: Record<string, any>, key: string): string {
  const prop = props[key];
  if (!prop || prop.type !== "date" || !prop.date) return "";
  return prop.date.start ?? "";
}

function getNotionClient(): Client {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY environment variable is not set");
  }
  return new Client({ auth: apiKey });
}

async function queryAllPages(databaseId: string): Promise<any[]> {
  const notion = getNotionClient();
  const pages: any[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: startCursor,
    });

    pages.push(...response.results);
    startCursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (startCursor);

  return pages;
}

export async function fetchProductsPricing(): Promise<ProductsPricingSnapshot> {
  const pages = await queryAllPages(NOTION_DB_IDS.productsPricing);

  const rows: ProductRow[] = pages.map((page: any) => {
    const props = page.properties ?? {};
    return {
      notionPageId: page.id,
      productName: getPropText(props, "Product/Tier Name"),
      audience: getPropSelect(props, "Audience"),
      billingCycle: getPropSelect(props, "Billing Cycle"),
      planType: getPropSelect(props, "Plan Type"),
      price: getPropNumber(props, "Price"),
      stripeProductId: getPropText(props, "Stripe Product ID"),
      stripePriceId: getPropText(props, "Stripe Price ID"),
      trialDays: getPropNumber(props, "Trial Days"),
      logicKey: getPropSelect(props, "Logic Key"),
      status: getPropSelect(props, "Status"),
      entitlementPageIds: getPropRelation(props, "Entitlements"),
      quotaSource: getPropSelect(props, "Quota Source"),
      activeInstruction: getPropText(props, "Active Instruction"),
    };
  });

  return {
    registry: "products_pricing",
    generatedAt: new Date().toISOString(),
    rows,
  };
}

export async function fetchFeaturesEntitlements(): Promise<FeaturesEntitlementsSnapshot> {
  const pages = await queryAllPages(NOTION_DB_IDS.featuresEntitlements);

  const rows: EntitlementRow[] = pages.map((page: any) => {
    const props = page.properties ?? {};
    return {
      notionPageId: page.id,
      entitlementName: getPropText(props, "Entitlement"),
      entitlementKey: getPropText(props, "Entitlement Key"),
      type: getPropSelect(props, "Type"),
      unit: getPropSelect(props, "Unit"),
      defaultValue: getPropText(props, "Default Value"),
      status: getPropSelect(props, "Status"),
    };
  });

  return {
    registry: "features_entitlements",
    generatedAt: new Date().toISOString(),
    rows,
  };
}

export async function fetchProductEntitlementOverrides(): Promise<ProductEntitlementOverridesSnapshot> {
  const pages = await queryAllPages(NOTION_DB_IDS.productEntitlementOverrides);

  const rows: OverrideRow[] = pages.map((page: any) => {
    const props = page.properties ?? {};
    const productIds = getPropRelation(props, "Product");
    const entitlementIds = getPropRelation(props, "Entitlement");

    return {
      notionPageId: page.id,
      overrideName: getPropText(props, "Override"),
      productPageId: productIds[0] ?? "",
      entitlementPageId: entitlementIds[0] ?? "",
      value: props["Value"]?.number ?? null,
      isUnlimited: getPropCheckbox(props, "Is Unlimited"),
      enabled: getPropCheckbox(props, "Enabled"),
      status: getPropSelect(props, "Status"),
      notes: getPropText(props, "Notes"),
    };
  });

  return {
    registry: "product_entitlement_overrides",
    generatedAt: new Date().toISOString(),
    rows,
  };
}

export async function fetchComplianceRules(): Promise<ComplianceRulesSnapshot> {
  const pages = await queryAllPages(NOTION_DB_IDS.complianceRules);

  const rows: ComplianceRuleRow[] = pages.map((page: any) => {
    const props = page.properties ?? {};
    return {
      notionPageId: page.id,
      ruleName: getPropText(props, "Rule"),
      category: getPropSelect(props, "Category"),
      appliesTo: getPropSelect(props, "Applies To"),
      enforcement: getPropSelect(props, "Enforcement"),
      jurisdiction: getPropText(props, "Jurisdiction"),
      requirements: getPropText(props, "Requirements"),
      implementationNotes: getPropText(props, "Implementation Notes"),
      status: getPropSelect(props, "Status"),
      effectiveDate: getPropDate(props, "Effective Date"),
      sourceLink: getPropUrl(props, "Source Link"),
    };
  });

  return {
    registry: "compliance_rules",
    generatedAt: new Date().toISOString(),
    rows,
  };
}
