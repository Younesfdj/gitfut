import { formatCount } from "../i18n/format";
import { t } from "../i18n/t";
import type { Locale } from "../i18n";
import { STATS } from "./constants";
import type { Metric, Signals, Stats, WorkRateLevel } from "./types";

// FUT-style attributes derived purely from real GitHub signals — no estimation.
// Each deriver returns its value plus a short, plain reason for the UI tooltip.

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// A real GitHub value mapped to 0–99, log-scaled against an "elite" reference.
const score99 = (value: number, ref: number) =>
  value <= 0 ? 0 : clamp(Math.round(99 * (Lg(value) / Lg(ref))), 1, 99);

export function deriveSkillMoves(s: Signals, locale: Locale = "en") {
  let value = s.languages >= 10 ? 5 : s.languages >= 7 ? 4 : s.languages >= 4 ? 3 : s.languages >= 2 ? 2 : 1;
  const bonus = s.public_repos >= 40 && value < 5;
  if (bonus) value += 1;
  const reason = t.attribute.skillMoves(
    value,
    s.languages,
    bonus,
    formatCount(s.public_repos, locale),
  );
  return { value, reason };
}

export function deriveWeakFoot(stats: Stats, locale: Locale = "en") {
  const sorted = STATS.map((k) => stats[k]).sort((a, b) => a - b);
  const weakSide = Math.round((sorted[0] + sorted[1] + sorted[2]) / 3);
  const value = weakSide >= 72 ? 5 : weakSide >= 63 ? 4 : weakSide >= 54 ? 3 : weakSide >= 45 ? 2 : 1;
  const reason = t.attribute.weakFoot(weakSide);
  return { value, reason };
}

const rate = (v: number): WorkRateLevel => (v >= 68 ? "High" : v >= 50 ? "Med" : "Low");

export function deriveWorkRate(stats: Stats, locale: Locale = "en") {
  const attack = rate(Math.round((stats.pac + stats.sho) / 2));
  const defense = rate(stats.def);
  const reason = t.workRate_reason(locale, attack, defense);
  return { attack, defense, reason };
}

// Source-of-truth for metric keys: every key here MUST exist in the i18n
// dictionary's `metrics`. The reverse direction is fine (extra dict keys are
// unused until referenced here).
type MetricKey =
  | "commits"
  | "starsEarned"
  | "topRepoReach"
  | "pullRequests"
  | "followers"
  | "languages"
  | "issues"
  | "codeReviews"
  | "contributions"
  | "accountAge"
  | "activeDays"
  | "repositories"
  | "activeYears";

// Canonical metric display keys — the single source for every surface that
// looks a metric up by label (the scout report renders them; lib/duel reads
// receipts back through them). The actual labels (commits/stars/etc.) are
// locale-dependent and live in lib/i18n/dict/<locale>.ts `metrics`. We keep
// the bare keys here as the canonical vocabulary so duel.ts and tests can
// reference them by name without importing the dictionary directly.
// Canonical metric DISPLAY labels — the single source for every surface that
// looks a metric up by label (the scout report renders them; lib/duel reads
// receipts back through them; legacy tests assert against these strings).
// Authors add a key here ONCE; an additional row in the i18n dictionary
// `metrics` block ensures non-EN locales can override. Calls in code that
// need a label-by-locale string should call `t.metric(key, locale)` instead.
//
// Renaming here flows everywhere at compile time.
export const METRIC_LABELS = {
  commits: "Commits",
  starsEarned: "Stars earned",
  topRepoReach: "Top repo reach",
  pullRequests: "Pull requests",
  followers: "Followers",
  languages: "Languages",
  issues: "Issues",
  codeReviews: "Code reviews",
  contributions: "Contributions",
} as const;

interface MetricDef {
  key: MetricKey;
  ref: number;
  value: (s: Signals) => number;
}

const CORE_METRICS: MetricDef[] = [
  { key: "commits", ref: 3_000, value: (s) => s.recent_commits },
  { key: "starsEarned", ref: 200_000, value: (s) => s.total_stars_owned },
  { key: "topRepoReach", ref: 150_000, value: (s) => s.max_repo_stars },
  { key: "pullRequests", ref: 2_000, value: (s) => s.prs_to_others },
  { key: "followers", ref: 100_000, value: (s) => s.followers },
  { key: "languages", ref: 15, value: (s) => s.languages },
  { key: "issues", ref: 1_500, value: (s) => s.issues_closed },
  { key: "codeReviews", ref: 2_000, value: (s) => s.reviews },
  { key: "contributions", ref: 50_000, value: (s) => s.total_contributions_lifetime },
];

const OPTIONAL_METRICS: MetricDef[] = [
  { key: "accountAge", ref: 15, value: (s) => Math.round(s.account_age_years) },
  { key: "activeDays", ref: 365, value: (s) => s.active_days_recent },
  { key: "repositories", ref: 200, value: (s) => s.public_repos },
  { key: "activeYears", ref: 15, value: (s) => s.active_years },
];

const toMetric = (def: MetricDef, s: Signals, locale: Locale): Metric => {
  const value = def.value(s);
  const dict = t.metric(def.key, locale);
  return { label: dict.label, value, unit: dict.unit, score: score99(value, def.ref) };
};

// Detail metrics: the core bars with any ZEROED ones hidden, plus one optional
// (non-zero) filler for every zeroed core metric beyond the first — so a sparse
// profile shows real data (age, active days, repos…) instead of zeros.
export function deriveMetrics(s: Signals, locale: Locale = "en"): Metric[] {
  const core = CORE_METRICS.map((d) => toMetric(d, s, locale));
  const shown = core.filter((m) => m.value > 0); // hide zeroed core metrics
  const fillerCount = Math.max(0, core.length - shown.length - 1);
  const fillers = OPTIONAL_METRICS.map((d) => toMetric(d, s, locale))
    .filter((m) => m.value > 0)
    .slice(0, fillerCount);
  return [...shown, ...fillers];
}

export function deriveStyle(s: Signals, locale: Locale = "en") {
  // 1) Pick the bucket using pure data (locale-independent),
  // 2) Pull the localized label + reason from the dictionary.
  let key: "Explosive" | "Relentless" | "Controlled" | "Clinical" | "Industrious" | "Measured";
  if (s.recent_spike) key = "Explosive";
  else if (s.active_days_recent >= 200 && s.recent_contributions >= 800) key = "Relentless";
  else if (s.account_age_years >= 6 && s.active_years >= 5) key = "Controlled";
  else if (s.max_repo_stars >= 5000 && s.recent_contributions < 200) key = "Clinical";
  else if (s.recent_contributions >= 300) key = "Industrious";
  else key = "Measured";
  const dict = t.style(key, locale);
  return { value: dict.value, reason: dict.reason };
}
