"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, type Locale } from "./index";

// read-only accessor for non-React-rendering contexts (effects, refs).
// Returns the live cookie value at the time of the call. The author of any
// component that wants *re-render on change* should use useLocale() from
// LocaleProvider instead.

export function getCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const parts = document.cookie.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === LOCALE_COOKIE_NAME && rest.length) {
      const v = decodeURIComponent(rest.join("="));
      if (v === "ko" || v === "en") return v;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Live cookie subscription. Updates when the cookie changes — useful for the
 * locale toggle, which just writes the cookie and lets every component react.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (cb: () => void) => {
      // Cookies are not reactive by themselves; we listen to a window event
      // dispatched by writeLocaleCookie on toggles, plus storage for cross-tab.
      if (typeof window === "undefined") return () => {};
      const onCustom = () => cb();
      const onStorage = (e: StorageEvent) => {
        if (e.key === LOCALE_COOKIE_NAME) cb();
      };
      window.addEventListener("gitfut:localechange", onCustom);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener("gitfut:localechange", onCustom);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => getCookieLocale(),
    () => DEFAULT_LOCALE,
  );
}
