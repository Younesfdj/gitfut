"use client";

// Locale-aware React hooks. Kept tiny and framework-agnostic so individual
// components can decide whether to call t() directly or wrap it through the
// scope-bound hook below.

import { useMemo } from "react";
import { useLocale } from "./useLocale";
import { getDict } from "./dictionaries";
import { t } from "./t";
import type { Locale } from "./index";
import type { Dictionary } from "./dict/types";

/**
 * Returns the entire UI dictionary for the active locale. Use when a
 * component renders many keys (modals, error pages) to avoid calling
 * t() in a tight loop and re-compiling each call.
 */
export function useUIDict(): Dictionary["ui"] {
  const locale = useLocale();
  return useMemo(() => getDict(locale).ui, [locale]);
}

/**
 * Returns a scoped translator bound to the active locale. Equivalent to
 * `(key, params) => t(key, locale, params)` but pulls once per render.
 */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const locale = useLocale();
  return (key, params) => t(key, locale, params);
}

/** Returns the active locale — useful when the consumer wants to call t.* helpers. */
export function useActiveLocale(): Locale {
  return useLocale();
}
