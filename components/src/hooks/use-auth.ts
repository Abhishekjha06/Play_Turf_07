import { useEffect, useState } from "react";
import { getUser, isLoading, refreshUser, subscribe } from "@/lib/auth";
import type { User } from "@/data/seed";

let inited = false;

export function useAuth() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => setTick((t) => t + 1));
    if (!inited) { inited = true; void refreshUser(); }
    return () => { unsub(); };
  }, []);
  return { user: getUser() as User | null, loading: isLoading() };
}
