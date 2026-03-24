import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];

  if (!url || url === 'https://your-project.supabase.co') {
    throw new Error(
      'SUPABASE_URL is not configured.\n' +
      'Add SUPABASE_URL to backend/api/.env'
    );
  }
  if (!key || key === 'your-service-role-key') {
    throw new Error(
      'SUPABASE_SERVICE_KEY is not configured.\n' +
      'Add SUPABASE_SERVICE_KEY to backend/api/.env'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}

export function hasSupabaseCredentials(): boolean {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];
  return (
    !!url && url !== 'https://your-project.supabase.co' &&
    !!key && key !== 'your-service-role-key'
  );
}
