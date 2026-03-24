import { createClient } from '@supabase/supabase-js';
let _client = null;
function getClient() {
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
export const CloudAuth = {
    async signIn(email, password) {
        const { data, error } = await getClient().auth.signInWithPassword({ email, password });
        if (error || !data.user) {
            throw new Error(`[CloudAuth] Sign-in failed: ${error?.message ?? 'Unknown error'}`);
        }
        return {
            id: data.user.id,
            email: data.user.email,
            tenantId: data.user.user_metadata?.['tenantId'],
        };
    },
    async signOut() {
        const { error } = await getClient().auth.signOut();
        if (error) {
            throw new Error(`[CloudAuth] Sign-out failed: ${error.message}`);
        }
    },
    async getSession() {
        const { data } = await getClient().auth.getSession();
        if (!data.session?.user)
            return null;
        const user = data.session.user;
        return {
            id: user.id,
            email: user.email,
            tenantId: user.user_metadata?.['tenantId'],
        };
    },
};
//# sourceMappingURL=auth.js.map