import { getSupabase } from "@/lib/supabase";

export async function checkRateLimit(identifier: string, action: string, maxAttempts: number = 5, minutesWindow: number = 15): Promise<boolean> {
    const supabase = await getSupabase();
    if (!supabase) return true; // mock mode

    // Fetch recent attempts
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

    if (count !== null && count >= maxAttempts) {
        return false;
    }

    // Record this attempt
    await supabase.from('rate_limits').insert({
        identifier,
        action
    });

    return true;
}
