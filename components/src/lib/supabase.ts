import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase client if env vars are configured, otherwise null.
 * Services check the return value and fall back to mock data when null.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
    if (_client) return _client;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return null;
    }

    try {
        _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return _client;
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
        return null;
    }
}

/** Check whether Supabase is configured (non-null client available). */
export async function isSupabaseConfigured(): Promise<boolean> {
    const client = await getSupabase();
    return client !== null;
}

