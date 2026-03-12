import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

/**
 * Supabase client for read-only catalog queries.
 * Uses the public anon key — protected by RLS policies.
 * Session persistence is disabled since catalog is unauthenticated.
 */
export const catalogClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
