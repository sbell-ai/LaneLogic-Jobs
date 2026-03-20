import { useQuery } from "@tanstack/react-query";
import { JOB_TAXONOMY } from "@shared/jobTaxonomy";

export type TaxonomyData = Record<string, Record<string, string[]>>;

const DEFAULT_TAXONOMY: TaxonomyData = Object.fromEntries(
  Object.entries(JOB_TAXONOMY).map(([industry, cats]) => [
    industry,
    Object.fromEntries(Object.entries(cats).map(([cat, labels]) => [cat, [...labels]])),
  ])
);

export function useTaxonomy() {
  const { data, isLoading } = useQuery<TaxonomyData>({
    queryKey: ["/api/taxonomy"],
    staleTime: 5 * 60 * 1000,
  });

  const taxonomy = data ?? DEFAULT_TAXONOMY;

  const industries = Object.keys(taxonomy);

  function getCategories(industry: string): string[] {
    return Object.keys(taxonomy[industry] ?? {});
  }

  function getAllCategories(): string[] {
    return industries.flatMap(ind => Object.keys(taxonomy[ind] ?? {}));
  }

  function getLabels(industry: string, category: string): string[] {
    return taxonomy[industry]?.[category] ?? [];
  }

  /** @deprecated use getLabels(industry, category) */
  function getSubcategories(category: string): string[] {
    for (const cats of Object.values(taxonomy)) {
      if (category in cats) return cats[category];
    }
    return [];
  }

  function getCategoryIndustry(category: string): string | undefined {
    return industries.find(ind => category in (taxonomy[ind] ?? {}));
  }

  function isValidCategory(category: string): boolean {
    return industries.some(ind => category in (taxonomy[ind] ?? {}));
  }

  function isValidLabel(category: string, label: string): boolean {
    const ind = getCategoryIndustry(category);
    if (!ind) return false;
    return (taxonomy[ind]?.[category] ?? []).includes(label);
  }

  return {
    taxonomy,
    industries,
    getCategories,
    getAllCategories,
    getLabels,
    getSubcategories,
    getCategoryIndustry,
    isValidCategory,
    isValidLabel,
    isLoading,
  };
}
