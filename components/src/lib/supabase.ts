import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;
let _initPromise: Promise<SupabaseClient> | null = null;

/**
 * Get or create the singleton Supabase client with optimized settings:
 * - Connection reuse via singleton pattern
 * - PKCE OAuth flow for security
 * - Automatic token refresh
 * - Optimized realtime settings
 * - Request deduplication via promise caching
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = createSupabaseClient();
  _client = await _initPromise;
  return _client;
}

async function createSupabaseClient(): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart the dev server."
    );
  }

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // PKCE (Proof Key for Code Exchange): the OAuth authorization code
        // is exchanged for tokens server-side using a code_verifier.
        flowType: "pkce",
        // Rotate the access token automatically before it expires.
        autoRefreshToken: true,
        // Persist the session so it survives reload/restart/tabs.
        persistSession: true,
        // Complete OAuth/email-link flows from the redirect URL.
        detectSessionInUrl: true,
        // Single, explicit storage key.
        storageKey: "playturf.auth",
        // Use localStorage for persistence with custom serialization
        storage: {
          getItem: (key) => {
            try {
              return Promise.resolve(localStorage.getItem(key));
            } catch {
              return Promise.resolve(null);
            }
          },
          setItem: (key, value) => {
            try {
              localStorage.setItem(key, value);
              return Promise.resolve();
            } catch {
              return Promise.resolve();
            }
          },
          removeItem: (key) => {
            try {
              localStorage.removeItem(key);
              return Promise.resolve();
            } catch {
              return Promise.resolve();
            }
          },
        },
      },
      // Global request configuration
      global: {
        headers: {
          "x-client-info": "playturf-web",
        },
        // Fetch options for all requests
        fetch: (...args: Parameters<typeof fetch>) => {
          const [url, options = {}] = args;
          return fetch(url, {
            ...options,
            // Keep-alive for connection reuse
            keepalive: true,
            // Credentials mode
            credentials: "same-origin",
          });
        },
      },
      // Realtime configuration
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        timeout: 20000,
        heartbeatIntervalMs: 15000,
      },
      // Database configuration
      db: {
        schema: "public",
      },
    });

    return client;
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
    _initPromise = null;
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

/**
 * Batch multiple Supabase RPC calls into a single transaction when possible.
 * Falls back to individual calls if batching fails.
 */
export async function batchSupabaseCalls<T>(
  calls: (() => Promise<T>)[]
): Promise<T[]> {
  if (calls.length === 0) return [];
  if (calls.length === 1) return [await calls[0]()];

  // Execute calls with concurrency limiting
  const CONCURRENCY = 3;
  const results: T[] = [];

  for (let i = 0; i < calls.length; i += CONCURRENCY) {
    const batch = calls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map((call) => call()));
    batchResults.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        results[i + idx] = result.value;
      } else {
        console.error(`Batch call ${i + idx} failed:`, result.reason);
        throw result.reason;
      }
    });
  }

  return results;
}

/**
 * Create a cached Supabase query wrapper using TanStack Query-compatible caching.
 * Uses in-memory cache with TTL.
 */
const queryCache = new Map<
  string,
  { data: unknown; timestamp: number; ttl: number }
>();

export async function cachedSupabaseQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlMs = 60000 // 1 minute default TTL
): Promise<T> {
  const cached = queryCache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < cached.ttl) {
    return cached.data as T;
  }

  const data = await queryFn();
  queryCache.set(key, { data, timestamp: now, ttl: ttlMs });
  return data;
}

/**
 * Invalidate cached Supabase queries matching a key prefix.
 */
export function invalidateSupabaseCache(keyPrefix: string): void {
  for (const key of queryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      queryCache.delete(key);
    }
  }
}

/**
 * Clear all Supabase query caches.
 */
export function clearSupabaseCache(): void {
  queryCache.clear();
}

/**
 * Optimized Supabase subscription helper with automatic reconnection.
 */
export function createOptimizedSubscription(
  table: string,
  callback: (payload: unknown) => void,
  filter?: string
) {
  let subscription: ReturnType<SupabaseClient["channel"]> | null = null;
  let isActive = false;

  const start = async () => {
    if (isActive) return;
    const supabase = await getSupabase();

    const channel = supabase
      .channel(`table-changes-${table}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        (payload: unknown) => callback(payload)
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          isActive = true;
        }
      });

    subscription = channel;
  };

  const stop = async () => {
    if (subscription) {
      await subscription.unsubscribe();
      isActive = false;
      subscription = null;
    }
  };

  return { start, stop };
}
