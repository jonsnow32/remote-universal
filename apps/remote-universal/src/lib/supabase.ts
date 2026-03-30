import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for read-only catalog queries.
 * Uses the public anon key — protected by RLS policies.
 * Session persistence is disabled since catalog is unauthenticated.
 *
 * Both the import AND the createClient() call are deferred to the first
 * getCatalogClient() invocation. `import type` is erased at compile time so
 * the @supabase/* module tree (which references FormData / fetch through its
 * transitive deps) is never evaluated during bundle startup — only after the
 * React Native runtime has finished setting up all globals.
 */
let _catalogClient: SupabaseClient | null = null;

export function getCatalogClient(): SupabaseClient {
  if (!_catalogClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    const url = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
    const key = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
    _catalogClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _catalogClient;
}
