import {
  QueryClient,
  QueryCache,
} from "@tanstack/react-query";

/**
 * React Query client with production-grade caching and performance settings.
 *
 * Policies:
 * - Stale-while-revalidate for lists (turfs, games, bookings)
 * - Short TTL for dynamic data (slots, availability)
 * - Aggressive background refetch for user-critical data
 * - Cache deduplication and request coalescing
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`[QueryCache] ${query.queryKey.join("/")} failed:`, error);
    },
  }),
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes, then stale
      staleTime: 1000 * 60 * 5,
      // Keep inactive data in cache for 10 minutes
      gcTime: 1000 * 60 * 10,
      // Retry failed queries 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus (but not aggressively)
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
      // Network mode: always try online first, fall back to cache
      networkMode: "online",
    },
    mutations: {
      // Retry mutations once (they're usually idempotent or user-initiated)
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/** Cache key factories for type-safe query keys */
export const queryKeys = {
  turfs: {
    all: ["turfs"] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.turfs.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.turfs.all, "detail", id] as const,
    favorites: ["turfs", "favorites"] as const,
    reviews: (turfId: string) => ["turfs", "reviews", turfId] as const,
  },
  games: {
    all: ["games"] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.games.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.games.all, "detail", id] as const,
  },
  bookings: {
    all: ["bookings"] as const,
    list: ["bookings", "list"] as const,
    upcoming: ["bookings", "upcoming"] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
  },
  offers: ["offers"] as const,
  banners: ["banners"] as const,
  tournaments: ["tournaments"] as const,
  health: ["health"] as const,
};

/** Invalidate all turf-related queries */
export function invalidateTurfs(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.turfs.all });
}

/** Invalidate all game-related queries */
export function invalidateGames(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
}

/** Invalidate all booking-related queries */
export function invalidateBookings(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
}

/** Set query data optimistically */
export function setOptimistic<T>(
  queryKey: readonly unknown[],
  updater: (old: T | undefined) => T
): void {
  queryClient.setQueryData(queryKey, updater);
}

/** Cancel outgoing queries for a key (useful before mutations) */
export function cancelQueries(queryKey: readonly unknown[]): Promise<void> {
  return queryClient.cancelQueries({ queryKey });
}
