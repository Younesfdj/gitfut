import { formatCount } from "../format";
import { STATS } from "./constants";
import type { Metric, Signals, Stats, WorkRateLevel } from "./types";

// FUT-style attributes derived purely from real GitHub signals — no estimation.
// Each deriver returns its value plus a short, plain reason for the UI tooltip.

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// A real GitHub value mapped to 0–99, log-scaled against an "elite" reference.
const score99 = (value: number, ref: number) =>
  value <= 0 ? 0 : clamp(Math.round(99 * (Lg(value) / Lg(ref))), 1, 99);

// Skill moves (1–5) = technical range: language diversity, +1 for broad output.
export function deriveSkillMoves(s: Signals): { value: number; reason: string } {
  let value = s.languages >= 10 ? 5 : s.languages >= 7 ? 4 : s.languages >= 4 ? 3 : s.languages >= 2 ? 2 : 1;
  const bonus = s.public_repos >= 40 && value < 5;
  if (bonus) value += 1;
  const reason = `Technical range: ${s.languages} language${s.languages === 1 ? "" : "s"}${
    bonus ? ` across ${formatCount(s.public_repos)} repos` : ""
  }.`;
  return { value, reason };
}

// Weak foot (1–5) = off-foot ability: how strong your WEAKER areas are (average
// of the three lowest stats), so a one-trick profile rates low.
export function deriveWeakFoot(stats: Stats): { value: number; reason: string } {
  const sorted = STATS.map((k) => stats[k]).sort((a, b) => a - b);
  const weakSide = Math.round((sorted[0] + sorted[1] + sorted[2]) / 3);
  const value = weakSide >= 72 ? 5 : weakSide >= 63 ? 4 : weakSide >= 54 ? 3 : weakSide >= 45 ? 2 : 1;
  return { value, reason: `Off-foot: your three weakest stats average ${weakSide}/99.` };
}

const rate = (v: number): WorkRateLevel => (v >= 68 ? "High" : v >= 50 ? "Med" : "Low");

// Work rate: attack = shipping output (PAC/SHO), defense = maintenance (DEF).
export function deriveWorkRate(stats: Stats): { attack: WorkRateLevel; defense: WorkRateLevel; reason: string } {
  const attack = rate(Math.round((stats.pac + stats.sho) / 2));
  const defense = rate(stats.def);
  return {
    attack,
    defense,
    reason: `Attack ${attack} from shipping output (commits, stars); defense ${defense} from reviews & issues.`,
  };
}

// Style: a one-word read of the recent activity pattern.
export function deriveStyle(s: Signals): { value: string; reason: string } {
  if (s.recent_spike) return { value: "Explosive", reason: "A recent burst well above your usual pace." };
  if (s.active_days_recent >= 200 && s.recent_contributions >= 800)
    return { value: "Relentless", reason: "Active on most days, all year round." };
  if (s.account_age_years >= 6 && s.active_years >= 5)
    return { value: "Controlled", reason: "A long, steady track record." };
  if (s.max_repo_stars >= 5000 && s.recent_contributions < 200)
    return { value: "Clinical", reason: "One big hit, quiet lately." };
  if (s.recent_contributions >= 300) return { value: "Industrious", reason: "Steadily active this year." };
  return { value: "Measured", reason: "Light recent activity." };
}

interface MetricDef {
  label: string;
  unit: string;
  ref: number; // value that maps to ~99
  value: (s: Signals) => number;
}

// Canonical metric display labels — the single source for every surface that
// looks a metric up by label (the scout report renders them; lib/duel reads
// receipts back through them). Renaming here flows everywhere at compile time.
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

// Core metrics — always shown (a few zeros are fine).
const CORE_METRICS: MetricDef[] = [
  { label: METRIC_LABELS.commits, unit: "commits", ref: 3_000, value: (s) => s.recent_commits },
  { label: METRIC_LABELS.starsEarned, unit: "stars", ref: 200_000, value: (s) => s.total_stars_owned },
  { label: METRIC_LABELS.topRepoReach, unit: "stars", ref: 150_000, value: (s) => s.max_repo_stars },
  { label: METRIC_LABELS.pullRequests, unit: "PRs", ref: 2_000, value: (s) => s.prs_to_others },
  { label: METRIC_LABELS.followers, unit: "followers", ref: 100_000, value: (s) => s.followers },
  { label: METRIC_LABELS.languages, unit: "languages", ref: 15, value: (s) => s.languages },
  { label: METRIC_LABELS.issues, unit: "issues", ref: 1_500, value: (s) => s.issues_closed },
  { label: METRIC_LABELS.codeReviews, unit: "reviews", ref: 2_000, value: (s) => s.reviews },
  { label: METRIC_LABELS.contributions, unit: "contributions", ref: 50_000, value: (s) => s.total_contributions_lifetime },
];

// Optional metrics — appended only to make up for zeroed core ones (see below).
// Display-only, like the core metrics: they don't feed playstyles or attributes.
const OPTIONAL_METRICS: MetricDef[] = [
  { label: "Account age", unit: "yrs", ref: 15, value: (s) => Math.round(s.account_age_years) },
  { label: "Active days", unit: "days", ref: 365, value: (s) => s.active_days_recent },
  { label: "Repositories", unit: "repos", ref: 200, value: (s) => s.public_repos },
  { label: "Active years", unit: "yrs", ref: 15, value: (s) => s.active_years },
];

const toMetric = (def: MetricDef, s: Signals): Metric => {
  const value = def.value(s);
  return { label: def.label, value, unit: def.unit, score: score99(value, def.ref) };
};

// Detail metrics: the core bars with any ZEROED ones hidden, plus one optional
// (non-zero) filler for every zeroed core metric beyond the first — so a sparse
// profile shows real data (age, active days, repos…) instead of zeros.
export function deriveMetrics(s: Signals): Metric[] {
  const core = CORE_METRICS.map((d) => toMetric(d, s));
  const shown = core.filter((m) => m.value > 0); // hide zeroed core metrics
  const fillerCount = Math.max(0, core.length - shown.length - 1);
  const fillers = OPTIONAL_METRICS.map((d) => toMetric(d, s))
    .filter((m) => m.value > 0)
    .slice(0, fillerCount);
  return [...shown, ...fillers];
}
