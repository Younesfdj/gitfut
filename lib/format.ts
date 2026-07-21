// Compact number formatting for display (1240 → "1.2k", 248723 → "249k", 1250000 → "1.3M").
// One decimal below 10 units ("1.2k"), none above ("249k"), so the string stays short.
const compact = (n: number, unit: number, suffix: string): string => {
  const scaled = n / unit;
  return scaled.toFixed(scaled >= 10 ? 0 : 1).replace(/\.0$/, "") + suffix;
};

export const formatCount = (n: number): string => {
  if (n >= 1_000_000) return compact(n, 1_000_000, "M");
  if (n >= 1000) {
    const thousands = compact(n, 1000, "k");
    // 999_500+ rounds up to "1000k" (toFixed(0) rounds half-up at 999.5); roll
    // over to the next unit rather than printing a four-digit thousands value.
    return thousands === "1000k" ? compact(n, 1_000_000, "M") : thousands;
  }
  return String(Math.round(n));
};

// Thousands-grouped number for tooltips and copy (5000 → "5,000"). Locale-locked
// to en-US so Node SSR and the client's browser locale always agree — otherwise
// a 5,000-tip on a Spanish-locale browser renders as "5.000" and React throws a
// hydration mismatch on the very first paint of any scout report that crosses
// the thousands threshold in a <Tip> text node.
export const formatThousands = (n: number): string => n.toLocaleString("en-US");

// Fixed-precision rounding for deterministic geometry / imperative transforms —
// shared so radar, VS burst and tilt all round identically.
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round1 = (n: number) => Math.round(n * 10) / 10;
