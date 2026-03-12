import { catalogClient } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  logo_uri: string | null;
}

export interface CatalogModel {
  id: string;
  brand_id: string;
  model_number: string;
  model_name: string | null;
  protocols: string[];
  category: string | null;
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/** Fetch all brands sorted alphabetically by name. */
export async function fetchAllBrands(): Promise<CatalogBrand[]> {
  const { data, error } = await catalogClient
    .from('brands')
    .select('id, name, slug, logo_uri')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogBrand[];
}

/**
 * Fetch distinct brands that have at least one model in the given category.
 * Returns brands sorted alphabetically by name.
 */
export async function fetchBrandsByCategory(category: string): Promise<CatalogBrand[]> {
  // Step 1: get distinct brand_ids for this category
  const { data: modelRows, error: e1 } = await catalogClient
    .from('device_models')
    .select('brand_id')
    .eq('category', category);

  if (e1) throw new Error(e1.message);

  const brandIds = [...new Set((modelRows ?? []).map((r: { brand_id: string }) => r.brand_id))];
  if (brandIds.length === 0) return [];

  // Step 2: fetch brand details
  const { data: brands, error: e2 } = await catalogClient
    .from('brands')
    .select('id, name, slug, logo_uri')
    .in('id', brandIds)
    .order('name');

  if (e2) throw new Error(e2.message);
  return (brands ?? []) as CatalogBrand[];
}

/**
 * Fetch device models for a given brand slug, optionally filtered by category.
 * Returns models sorted by model_number.
 */
export async function fetchModelsByBrand(
  brandSlug: string,
  category?: string,
): Promise<CatalogModel[]> {
  let query = catalogClient
    .from('device_models')
    .select('id, brand_id, model_number, model_name, protocols, category')
    .eq('brand_id', brandSlug)
    .order('model_number');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    brand_id: row.brand_id as string,
    model_number: row.model_number as string,
    model_name: (row.model_name ?? null) as string | null,
    category: (row.category ?? null) as string | null,
    protocols: Array.isArray(row.protocols) ? (row.protocols as string[]) : [],
  }));
}
