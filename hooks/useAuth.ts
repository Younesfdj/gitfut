"use client";

import { useEffect, useState } from "react";

export interface AuthMe {
  configured: boolean;
  login: string | null;
  avatarUrl: string | null;
}

export function useAuth(): AuthMe & { loading: boolean; refresh: () => void } {
  const [state, setState] = useState<AuthMe>({ configured: false, login: null, avatarUrl: null });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as AuthMe;
        if (!cancelled) setState(data);
      } catch {
        if (!cancelled) setState({ configured: false, login: null, avatarUrl: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    ...state,
    loading,
    refresh: () => {
      setLoading(true);
      setTick((t) => t + 1);
    },
  };
}

export function signInHref(returnTo: string): string {
  return `/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function signOut(returnTo = "/"): Promise<void> {
  await fetch("/api/auth/signout", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ returnTo }),
  });
  window.location.href = returnTo;
}
