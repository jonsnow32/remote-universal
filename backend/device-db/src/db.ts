/**
 * Supabase client for the device-db service.
 * Uses the service role key so writes bypass Row Level Security.
 * Client is created lazily — only when credentials are present and needed.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client.
 * Throws if SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.
 * Call only when you actually need to write (i.e. not in dry-run mode).
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];

  if (!url || url === 'https://your-project.supabase.co') {
    throw new Error(
      'SUPABASE_URL is not configured.\n' +
      'Copy backend/device-db/.env.example to backend/device-db/.env and fill in your project URL.'
    );
  }
  if (!key || key === 'your-service-role-key') {
    throw new Error(
      'SUPABASE_SERVICE_KEY is not configured.\n' +
      'Copy backend/device-db/.env.example to backend/device-db/.env and fill in your service role key.'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}

/** Returns true when Supabase credentials are present and look valid. */
export function hasSupabaseCredentials(): boolean {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  return (
    !!url && url !== 'https://your-project.supabase.co' &&
    !!key && key !== 'your-service-role-key'
  );
}

/** Table row shapes that mirror catalogSchema.ts */
export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logo_uri?: string;
  country?: string;
  website?: string;
  canonical_id?: string;
  created_at: number;
  updated_at: number;
}

export interface DeviceModelRow {
  id: string;
  brand_id: string;
  model_number: string;
  model_name: string;
  category: string;
  year_from?: number;
  year_to?: number;
  protocols: string;       // JSON array string
  capabilities: string;    // JSON array string
  thumbnail_uri?: string;
  source: string;
  catalog_version?: string;
  created_at: number;
  updated_at: number;
}

export interface CommandDefinitionRow {
  id: string;
  model_id: string | null;
  brand_id: string | null;
  name: string;
  label: string;
  icon?: string;
  capability?: string;
  sort_order?: number;
  // IR
  ir_pronto?: string;
  ir_raw?: string;
  ir_frequency?: number;
  ir_protocol?: string;
  // WiFi
  wifi_method?: string;
  wifi_endpoint?: string;
  wifi_payload?: string;
  wifi_headers?: string;
}
