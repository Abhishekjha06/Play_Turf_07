import { getSupabase } from "@/lib/supabase";

/**
 * Checks how many attempts were recorded for this identifier+action within the
 * window. CHECK ONLY — never writes. Callers decide which attempts are worth
 * recording via recordRateLimitAttempt().
 */
export async function checkRateLimit(identifier: string, action: string, maxAttempts: number = 5, minutesWindow: number = 15): Promise<boolean> {
    const supabase = await getSupabase();
    if (!supabase) return true; // mock mode

    const timeAgo = new Date(Date.now() - minutesWindow * 60000).toISOString();

    const { count, error } = await supabase
        .from('rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('identifier', identifier)
        .eq('action', action)
        .gte('created_at', timeAgo);

    if (error) {
        console.error("Rate limit check error:", error);
        return true; // fail open
    }

    return count === null || count < maxAttempts;
}

/**
 * Records exactly one attempt. Call this ONLY for failures the user is
 * responsible for — e.g. a rejected Supabase auth response — so successful
 * logins and network hiccups never lock anyone out. Errors here fail open.
 */
export async function recordRateLimitAttempt(identifier: string, action: string): Promise<void> {
    const supabase = await getSupabase();
    if (!supabase) return;

    const { error } = await supabase.from('rate_limits').insert({ identifier, action });
    if (error) console.error("Rate limit record error:", error);
}
