import { getCatalogClient } from './supabase';
import {
  isCatalogLocalDbReady,
  localFetchAllBrands,
  localFetchBrandsByCategory,
  localFetchModelsByBrand,
  localSearchModels,
  upsertBrands,
  upsertModels,
} from './catalogLocalDb';

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

/** Safely coerce protocols from any storage format to string[]. */
function parseProtocols(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch {}
  }
  return [];
}

// ─── Remote (Supabase) fetchers ──────────────────────────────────────────────

async function remoteFetchAllBrands(): Promise<CatalogBrand[]> {
  const { data, error } = await getCatalogClient()
    .from('brands')
    .select('id, name, slug, logo_uri')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogBrand[];
}

async function remoteFetchBrandsByCategory(category: string): Promise<CatalogBrand[]> {
  const { data: modelRows, error: e1 } = await getCatalogClient()
    .from('device_models')
    .select('brand_id')
    .eq('category', category);

  if (e1) throw new Error(e1.message);

  const brandIds = [...new Set((modelRows ?? []).map((r: { brand_id: string }) => r.brand_id))];
  if (brandIds.length === 0) return [];

  const { data: brands, error: e2 } = await getCatalogClient()
    .from('brands')
    .select('id, name, slug, logo_uri')
    .in('id', brandIds)
    .order('name');

  if (e2) throw new Error(e2.message);
  return (brands ?? []) as CatalogBrand[];
}

async function remoteFetchModelsByBrand(
  brandSlug: string,
  category?: string,
): Promise<CatalogModel[]> {
  let query = getCatalogClient()
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
    protocols: parseProtocols(row.protocols),
  }));
}

async function remoteSearchModels(query: string): Promise<CatalogModel[]> {
  const { data, error } = await getCatalogClient()
    .from('device_models')
    .select('id, brand_id, model_number, model_name, protocols, category')
    .or(`model_number.ilike.%${query}%,model_name.ilike.%${query}%`)
    .limit(25)
    .order('model_number');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    brand_id: row.brand_id as string,
    model_number: row.model_number as string,
    model_name: (row.model_name ?? null) as string | null,
    category: (row.category ?? null) as string | null,
    protocols: parseProtocols(row.protocols),
  }));
}

// ─── Local-first public API ──────────────────────────────────────────────────
//
// Strategy for every query:
//   1. If local DB is ready → query locally
//   2. If local returns results → return them immediately
//      AND fire a background Supabase refresh (stale-while-revalidate)
//   3. If local returns empty → fallback to Supabase → persist → return
//   4. If local DB is NOT ready → go straight to Supabase
//

/** Fetch all brands — local first, remote fallback + sync. */
export async function fetchAllBrands(): Promise<CatalogBrand[]> {
  if (isCatalogLocalDbReady()) {
    const local = localFetchAllBrands();
    if (local.length > 0) {
      // Background refresh: fetch from Supabase and update local cache
      remoteFetchAllBrands().then(remote => upsertBrands(remote)).catch(() => {});
      return local;
    }
  }
  // Fallback to Supabase
  const remote = await remoteFetchAllBrands();
  if (isCatalogLocalDbReady()) upsertBrands(remote);
  return remote;
}

/** Fetch brands by category — local first, remote fallback + sync. */
export async function fetchBrandsByCategory(category: string): Promise<CatalogBrand[]> {
  if (isCatalogLocalDbReady()) {
    const local = localFetchBrandsByCategory(category);
    if (local.length > 0) {
      remoteFetchBrandsByCategory(category).then(remote => upsertBrands(remote)).catch(() => {});
      return local;
    }
  }
  const remote = await remoteFetchBrandsByCategory(category);
  if (isCatalogLocalDbReady()) upsertBrands(remote);
  return remote;
}

/** Fetch models by brand — local first, remote fallback + sync. */
export async function fetchModelsByBrand(
  brandSlug: string,
  category?: string,
): Promise<CatalogModel[]> {
  if (isCatalogLocalDbReady()) {
    const local = localFetchModelsByBrand(brandSlug, category);
    if (local.length > 0) {
      remoteFetchModelsByBrand(brandSlug, category)
        .then(remote => upsertModels(remote))
        .catch(() => {});
      return local;
    }
  }
  const remote = await remoteFetchModelsByBrand(brandSlug, category);
  if (isCatalogLocalDbReady()) upsertModels(remote);
  return remote;
}

/** Search models — local first, remote fallback + sync. */
export async function searchModels(query: string): Promise<CatalogModel[]> {
  if (isCatalogLocalDbReady()) {
    const local = localSearchModels(query);
    if (local.length > 0) {
      remoteSearchModels(query).then(remote => upsertModels(remote)).catch(() => {});
      return local;
    }
  }
  const remote = await remoteSearchModels(query);
  if (isCatalogLocalDbReady()) upsertModels(remote);
  return remote;
}
