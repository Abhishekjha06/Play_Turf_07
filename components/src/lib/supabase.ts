import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

export async function getSupabase(): Promise<SupabaseClient> {
    if (_client) return _client;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error(
            "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart the dev server."
        );
    }

    try {
        _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        });
        return _client;
    } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
        throw err;
    }
}

/** Check whether Supabase is configured (non-null client available). */
export async function isSupabaseConfigured(): Promise<boolean> {
    return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

/**
 * Returns the Supabase client, or THROWS if it is not configured.
 *
 * Use this for any write/mutation (RPC, insert/update/delete) that MUST reach
 * Supabase and must never silently fall back to a localStorage mock. Use
 * `getSupabase()` for read-only paths that are allowed to degrade gracefully.
 */
export async function requireSupabase(): Promise<SupabaseClient> {
    return getSupabase();
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve in the given milliseconds,
 * it rejects with a timeout error.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("Supabase query timed out"));
        }, ms);

        promise
            .then((res) => {
                clearTimeout(timer);
                resolve(res);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

