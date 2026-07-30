"use client";

// Client-side locale context. Hydrates from the cookie written by the server
// (no flicker — the cookie name matches LOCALE_COOKIE_NAME). The provider is
// intentionally minimal: a single string + a setter. Components that want a
// reactive locale should consume the hook below; pure renderers can pull the
// current locale off the context via useT() and stay reactive by listening.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale } from "./index";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const v = document.cookie
    .split(";")
    .map((c) => c.trim().split("="))
    .find((parts) => parts[0] === LOCALE_COOKIE_NAME);
  const raw = v && v.length === 2 ? decodeURIComponent(v[1]) : null;
  return raw === "ko" || raw === "en" ? raw : DEFAULT_LOCALE;
}

export function writeLocaleCookie(locale: Locale, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
  // Manually fire our cross-listener event so every useLocale() subscriber
  // flips without depending on the storage event (which only fires in OTHER
  // tabs). The LocaleProvider state is independent of this hook.
  window.dispatchEvent(new Event("gitfut:localechange"));
}

interface ProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

/**
 * Provides the current locale to descendants. If `initialLocale` is supplied
 * (server case) we use it on first render to avoid hydration mismatch; the
 * cookie is then consulted on mount to follow the user's most recent choice.
 */
export function LocaleProvider({ children, initialLocale }: ProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    // Initial server set may be stale (user toggled in another tab); pick up
    // the freshest cookie on first interaction-free mount.
    const fromCookie = readLocaleCookie();
    if (fromCookie !== locale) setLocaleState(fromCookie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocaleCookie(next, 60 * 60 * 24 * 365);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext(): LocaleContextValue {
  return useContext(LocaleContext);
}
