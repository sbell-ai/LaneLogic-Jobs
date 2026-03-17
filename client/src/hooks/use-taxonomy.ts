import { useQuery } from "@tanstack/react-query";
import { JOB_TAXONOMY } from "@shared/jobTaxonomy";

export type TaxonomyData = Record<string, string[]>;

const DEFAULT_TAXONOMY: TaxonomyData = Object.fromEntries(
  Object.entries(JOB_TAXONOMY).map(([k, v]) => [k, [...v]])
);

export function useTaxonomy() {
  const { data, isLoading } = useQuery<TaxonomyData>({
    queryKey: ["/api/taxonomy"],
    staleTime: 5 * 60 * 1000,
  });

  const taxonomy = data ?? DEFAULT_TAXONOMY;
  const categories = Object.keys(taxonomy);

  function getSubcategories(category: string): string[] {
    return taxonomy[category] ?? [];
  }

  function isValidCategory(category: string): boolean {
    return category in taxonomy;
  }

  function isValidSubcategory(category: string, subcategory: string): boolean {
    return (taxonomy[category] ?? []).includes(subcategory);
  }

  return { taxonomy, categories, getSubcategories, isValidCategory, isValidSubcategory, isLoading };
}
