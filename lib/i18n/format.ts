// Locale-aware number + count formatting. Wraps Intl.NumberFormat / Intl.PluralRules
// so the scout report can show "1.2k" in EN and "1.2천" in KO without each
// consumer re-implementing the compact rules.
//
// EN behavior is preserved exactly (1.2k, 249k, 1.3M). KO has a parallel
// number system (만/억), but the metric UI uses short abbreviations consistent
// with FIFA FUT-style displays; for the count translations we use ko labels,
// for raw numerals we keep plain `n.toLocaleString("ko-KR")` (groups with 만)
// to read correctly alongside the thousands unit.
//
// Single source of truth for compact display strings. The metric *unit* is
// translated separately in dict/<locale>.ts (`metrics.<key>.unit`).

import type { Locale } from "./index";

// Compact suffixes used in the scout report's "1.2k stars" etc.
//  - English: "k" / "M"
//  - Korean: we keep Roman forms ("k" / "M") because mixing native + Roman
//    units reads worse than consistent Roman; Korean unit nouns come from the
//    metric dict (received as "별" / "커밋" etc.)
const COMPACT: Record<Locale, { thousand: string; million: string }> = {
  en: { thousand: "k", million: "M" },
  ko: { thousand: "k", million: "M" },
};

const compact = (n: number, unit: number, suffix: string): string => {
  const scaled = n / unit;
  return scaled.toFixed(scaled >= 10 ? 0 : 1).replace(/\.0$/, "") + suffix;
};

/**
 * formatCount(n, locale) → "1.2k" / "249k" / "1.3M".
 * Same rounding rules as the original `formatCount` so existing API responses
 * keep rendering identically in EN.
 */
export function formatCount(n: number, locale: Locale): string {
  const c = COMPACT[locale] ?? COMPACT.en;
  if (n >= 1_000_000) return compact(n, 1_000_000, c.million);
  if (n >= 1000) {
    const thousands = compact(n, 1000, c.thousand);
    return thousands === `1000${c.thousand}` ? compact(n, 1_000_000, c.million) : thousands;
  }
  return String(Math.round(n));
}

/** Locale-aware digit grouping for plain numbers. EN: 12,340. KO: 12,340. */
export function formatInt(n: number, locale: Locale): string {
  const tag = locale === "ko" ? "ko-KR" : "en-US";
  return Math.round(n).toLocaleString(tag);
}

/** Format a metric unit/value pair using the locale's compact rule + unit noun. */
export function formatMetric(value: number, locale: Locale, unit: string): string {
  return `${formatCount(value, locale)} ${unit}`;
}
