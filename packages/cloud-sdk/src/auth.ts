import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_ANON_KEY'];
    if (!url || !key) {
      throw new Error('[CloudAuth] Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.');
    }
    _client = createClient(url, key);
  }
  return _client;
}

export interface AuthUser {
  id: string;
  email: string | undefined;
  tenantId: string | undefined;
}

export const CloudAuth = {
  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(`[CloudAuth] Sign-in failed: ${error?.message ?? 'Unknown error'}`);
    }
    return {
      id: data.user.id,
      email: data.user.email,
      tenantId: data.user.user_metadata?.['tenantId'] as string | undefined,
    };
  },

  async signOut(): Promise<void> {
    const { error } = await getClient().auth.signOut();
    if (error) {
      throw new Error(`[CloudAuth] Sign-out failed: ${error.message}`);
    }
  },

  async getSession(): Promise<AuthUser | null> {
    const { data } = await getClient().auth.getSession();
    if (!data.session?.user) return null;
    const user = data.session.user;
    return {
      id: user.id,
      email: user.email,
      tenantId: user.user_metadata?.['tenantId'] as string | undefined,
    };
  },
};
