import { useQuery } from '@tanstack/react-query';
import { fetchAllBrands, fetchBrandsByCategory, fetchModelsByBrand, searchModels } from '../lib/catalogApi';
import type { CatalogBrand, CatalogModel } from '../lib/catalogApi';

export type { CatalogBrand, CatalogModel };

/** Fetch all brands. Stale after 30 minutes. */
export function useAllBrands() {
  return useQuery<CatalogBrand[]>({
    queryKey: ['catalog', 'brands', 'all'],
    queryFn: fetchAllBrands,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Fetch brands that have at least one model in the given category.
 * Stale after 30 minutes — catalog data rarely changes.
 */
export function useBrandsByCategory(category: string | null) {
  return useQuery<CatalogBrand[]>({
    queryKey: ['catalog', 'brands', category],
    queryFn: () => fetchBrandsByCategory(category!),
    enabled: category != null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Fetch device models for a given brand slug, optionally filtered by category.
 * Enabled once brandSlug is provided.
 */
export function useModelsByBrand(brandSlug: string | null, category?: string | null) {
  return useQuery<CatalogModel[]>({
    queryKey: ['catalog', 'models', brandSlug, category ?? null],
    queryFn: () => fetchModelsByBrand(brandSlug!, category ?? undefined),
    enabled: brandSlug != null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Search device models by model_number / model_name across all brands.
 * Only fires when query has at least 2 characters.
 */
export function useSearchModels(query: string) {
  return useQuery<CatalogModel[]>({
    queryKey: ['catalog', 'search', 'models', query],
    queryFn: () => searchModels(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
