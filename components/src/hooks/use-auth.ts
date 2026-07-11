import { useEffect, useRef, useState } from "react";
import { getUser, isLoading, refreshUser, subscribe, initSupabaseListener } from "@/lib/auth";
import type { User } from "@/data/seed";

export function useAuth() {
  const [, setTick] = useState(0);
  const inited = useRef(false);

  useEffect(() => {
    initSupabaseListener(); // lazy init on first auth hook usage
    const unsub = subscribe(() => setTick((t) => t + 1));
    if (!inited.current) {
      inited.current = true;
      void refreshUser();
    }
    return () => { unsub(); };
  }, []);

  return { user: getUser() as User | null, loading: isLoading() };
}
