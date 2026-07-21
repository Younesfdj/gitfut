import { DIST_MIN } from "./distribution-data";

// Where a card stands in the sampled rating histogram — the "TOP 0.02% of GitHub"
// claim under the scouting metrics. Pure and framework-agnostic so the statistic
// can be tested on its own: it's a number we assert publicly about someone, and
// the histogram is a snapshot that gets regenerated (scripts/distribution-runner),
// so the maths has to hold for a sample of any size.

export interface Standing {
  /** Sampled accounts rated at or above this card. */
  atOrAbove: number;
  /** Share of the sample at or above, in percent. An upper bound when `bounded`. */
  pct: number;
  /** True when NOTHING in the sample reached this rating, so pct is a bound. */
  bounded: boolean;
  /** Display label, e.g. "Top 3.2%" or "Top < 0.02%". */
  label: string;
}

// Percent → display string: whole numbers from 10 up, one decimal from 1, two
// below that.
export function formatPct(p: number): string {
  if (p >= 10) return String(Math.round(p));
  if (p >= 1) return p.toFixed(1);
  return p.toFixed(2);
}

/**
 * The card's standing in a histogram where `counts[i]` holds the number of
 * sampled accounts rated `min + i`.
 *
 * When nothing in the sample reaches the card's rating, the honest claim isn't
 * "top 0%" — it's the rule-of-three bound: with none observed in n samples, the
 * true share is below 3/n at 95% confidence. That case is marked `bounded` and
 * labelled with a "<".
 */
export function standing(
  counts: readonly number[],
  n: number,
  overall: number,
  min: number = DIST_MIN,
): Standing {
  const atOrAbove = counts.reduce((sum, c, i) => sum + (min + i >= overall ? c : 0), 0);
  const bounded = atOrAbove === 0;
  // Guard n: an empty sample has no claim to make rather than an Infinity/NaN one.
  const pct = n > 0 ? (100 * (bounded ? 3 : atOrAbove)) / n : 0;
  return { atOrAbove, pct, bounded, label: `Top ${bounded ? "< " : ""}${formatPct(pct)}%` };
}
