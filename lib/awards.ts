import type { AwardInstance, AwardKey, Card, YearBreakdown } from "@/lib/scoring/types";

// The trophy cabinet. Four awards, each honest to its own data:
//
//   Ballon d'Or      — WON, per year. A profile's standout years vs its own
//                      career (log multi-factor score, so volume spam can't
//                      brute-force it and a commits-only legend still counts).
//   WC Golden Ball   — WON, per World-Cup edition. Rose above their own pace
//                      during the tournament window (era-adjusted: existing on
//                      GitHub at all in 2010 was already elite).
//   Golden Boot      — HELD, current form. Top scorer: shooting stat + a post
//                      that scores goals. No year attached.
//   World Cup trophy — GIFT. Spain won WC26; every Spain-native profile (the
//                      GitHub-profile location, never the flag-picker override)
//                      carries the trophy. buildCard derives country before
//                      overrides exist, so card.country is already native here.
//
// Duels never mint any of these — corners showcase what each card walked in
// with. Computed server-side at scout time (lib/scout) and stored on the card,
// so cached cards keep their cabinet and the flag override can't fake Spain.

export type { AwardInstance, AwardKey } from "@/lib/scoring/types";

export interface AwardMeta {
  title: string;
  shelfLabel: string;
  metricLabel: string; // the badge pill in the details modal
  description: string;
}

export const AWARD_META: Record<AwardKey, AwardMeta> = {
  ballon_dor: {
    title: "Ballon d'Or",
    shelfLabel: "BALLON D'OR",
    metricLabel: "Year of a Legend",
    description:
      "The game's highest individual honour, for a calendar year that towers over the rest of a career. Any position, any style. What counts is that the year was undeniable.",
  },
  wc_golden_ball: {
    title: "World Cup Golden Ball",
    shelfLabel: "GOLDEN BALL",
    metricLabel: "Tournament Talisman",
    description:
      "Best player of a World Cup. Awarded for rising above the player's usual pace while the tournament was on, form when the lights were brightest.",
  },
  golden_boot: {
    title: "Golden Boot",
    shelfLabel: "GOLDEN BOOT",
    metricLabel: "Elite Star Attraction",
    description:
      "The season's top scorer. Held, not kept: awarded on current form to finishers whose repositories keep hitting the net.",
  },
  world_cup: {
    title: "World Cup Trophy",
    shelfLabel: "WORLD CUP",
    metricLabel: "Campeones WC26",
    description:
      "Spain won the 2026 World Cup, and every Spanish profile lifts the trophy with them. A gift from GitFut to the champions' bench.",
  },
};

// ---- The shared year score -------------------------------------------------
// Log multi-factor, same physics as the scoring engine's Lg() curves: each
// dimension saturates, so 20k commits barely outscore 2k and a spammer caps out
// on one axis while any real year collects across several. No hard balance
// gate — a commits-only kernel legend scores on volume axes alone.

const lg = (n: number) => Math.log10(1 + Math.max(0, n));

export const yearScore = (y: YearBreakdown): number =>
  4 * lg(y.commits) + 3 * lg(y.prs) + 3 * lg(y.reviews) + 2 * lg(y.issues) + 2 * lg(y.restricted);

const rawTotal = (y: YearBreakdown) => y.commits + y.prs + y.reviews + y.issues + y.restricted;

// Every award requires a real profile; a floor, never a driver (the rating is
// generous, so this only keeps genuinely thin cards off the podium).
const AWARD_OVR_FLOOR = 80;

// ---- Ballon d'Or -----------------------------------------------------------
// A year wins when it clears the floor AND either stands out against the
// profile's own career median (the spike path — one great year in a modest
// career) or is elite in absolute terms (the legend path — a sustained-great
// career has a huge median no year can tower over, yet those years are exactly
// what the award exists for). Cap 3 (icons get a 4th — the 90s-are-earned tier
// already encodes "legend"), and repeats demand a stronger profile: each extra
// trophy needs a higher overall (BDO_OVR_LADDER). The current partial year
// competes as-is: it can only under-score, never over-score.

// Calibrated on real careers: torvalds' kernel years (commits-only, ~2.5k/yr +
// a few PRs) score ~17-20 and his best two clear the elite bar; a flat
// 20k-commits-only spam career scores ~17 per year and clears nothing.
const BDO_FLOOR = 16; // a genuinely strong year, in score terms
const BDO_MIN_RAW = 2000; // and in raw volume — no Ballon d'Or under 2k contributions
const BDO_RATIO = 1.2; // spike path: 1.2× the career-median year
const BDO_ELITE = 19.5; // legend path: elite in absolute terms, ratio waived
const BDO_CAP = 3;
// Icons may take a 4th — but only for a monster year (score ≥ this), so the
// extra trophy stays exceptional instead of a routine icon perk.
const BDO_FOURTH = 28;
// Repeats demand a stronger profile: the n-th Ballon d'Or needs the card's
// overall past the n-th floor — one at 80, a second at 87, a third (or an
// icon's 4th) at 94. First-win difficulty is untouched.
const BDO_OVR_LADDER = [AWARD_OVR_FLOOR, 87, 94, 94];

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

function ballonDors(card: Card): AwardInstance[] {
  const years = card.years ?? [];
  if (card.overall < AWARD_OVR_FLOOR || years.length < 2) return [];

  const scored = years.map((y) => ({ y, score: yearScore(y) }));
  const mid = median(scored.map((s) => s.score));
  if (mid <= 0) return [];

  const qualifying = scored
    .filter(
      (s) =>
        rawTotal(s.y) >= BDO_MIN_RAW &&
        s.score >= BDO_FLOOR &&
        (s.score >= BDO_RATIO * mid || s.score >= BDO_ELITE),
    )
    .sort((a, b) => b.score - a.score);
  const icon = card.finish === "icon" || card.finish === "founder";
  const iconCap = icon && qualifying[BDO_CAP]?.score >= BDO_FOURTH ? BDO_CAP + 1 : BDO_CAP;
  const ovrCap = BDO_OVR_LADDER.filter((floor) => card.overall >= floor).length;
  // Reasons are factual and third-person (cards are mostly viewed by OTHERS),
  // and never claim a rank: rank comes from score, where breadth can beat raw
  // volume, and "career-best: 2,113" next to "#2: 3,928" reads as nonsense.
  return qualifying
    .slice(0, Math.min(iconCap, ovrCap))
    .sort((a, b) => a.y.year - b.y.year)
    .map(({ y, score }) => {
      const ratio = score / mid;
      const lead =
        ratio >= BDO_RATIO ? `${ratio.toFixed(1)}× the career-median season` : "An elite season";
      return {
        key: "ballon_dor" as const,
        year: y.year,
        reason: `${lead}: ${rawTotal(y).toLocaleString()} contributions, ${workKinds(y)}.`,
      };
    });
}

// "commits, PRs and reviews" — the kinds of work that made the year.
const workKinds = (y: YearBreakdown) => {
  const kinds = (
    [
      [y.commits, "commits"],
      [y.prs, "PRs"],
      [y.reviews, "reviews"],
      [y.issues, "issues"],
      [y.restricted, "private work"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([, label]) => label);
  if (kinds.length === 1) return `all in ${kinds[0]}`;
  return `spread over ${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
};

// ---- World Cup Golden Ball -------------------------------------------------
// One per edition. Judged on the tournament window itself (fetched separately —
// see fetchWcWindows in lib/github/client), era-adjusted: early-GitHub editions
// need little more than presence; modern ones demand real tournament form.

export interface WcEdition {
  edition: string;
  year: number;
  from: string; // ISO datetime, tournament opening day
  to: string; // ISO datetime, final day
  span: string; // human dates for award copy, e.g. "Jun 11 – Jul 11, 2010"
  days: number;
  /** Scales the absolute floor — 2010 GitHub was a ghost town; being there counted. */
  floorScale: number;
  /** Window daily pace must beat this × the same year's pace. 0 = no form gate. */
  formRatio: number;
}

export const WC_EDITIONS: readonly WcEdition[] = [
  { edition: "South Africa 2010", year: 2010, from: "2010-06-11T00:00:00Z", to: "2010-07-11T23:59:59Z", span: "Jun 11 – Jul 11, 2010", days: 31, floorScale: 0.15, formRatio: 0 },
  { edition: "Brazil 2014", year: 2014, from: "2014-06-12T00:00:00Z", to: "2014-07-13T23:59:59Z", span: "Jun 12 – Jul 13, 2014", days: 32, floorScale: 0.3, formRatio: 0 },
  { edition: "Russia 2018", year: 2018, from: "2018-06-14T00:00:00Z", to: "2018-07-15T23:59:59Z", span: "Jun 14 – Jul 15, 2018", days: 32, floorScale: 0.6, formRatio: 1.2 },
  { edition: "Qatar 2022", year: 2022, from: "2022-11-20T00:00:00Z", to: "2022-12-18T23:59:59Z", span: "Nov 20 – Dec 18, 2022", days: 29, floorScale: 1, formRatio: 1.3 },
  { edition: "North America 2026", year: 2026, from: "2026-06-11T00:00:00Z", to: "2026-07-19T23:59:59Z", span: "Jun 11 – Jul 19, 2026", days: 39, floorScale: 1, formRatio: 1.3 },
];

// A strong ~5-week window at full scale; era floorScale shrinks it.
const WC_BALL_FLOOR = 10;

/** Contribution totals inside one WC window, keyed to its edition. */
export interface WcWindowTotals extends YearBreakdown {
  edition: string;
}

function wcGoldenBalls(card: Card, windows: WcWindowTotals[], now: Date): AwardInstance[] {
  if (card.overall < AWARD_OVR_FLOOR) return [];
  const byYear = new Map((card.years ?? []).map((y) => [y.year, y]));

  return WC_EDITIONS.flatMap((ed) => {
    const win = windows.find((w) => w.edition === ed.edition);
    if (!win) return [];
    if (yearScore(win) < WC_BALL_FLOOR * ed.floorScale) return [];

    const winRaw = rawTotal(win);
    if (ed.formRatio > 0) {
      const yearRow = byYear.get(ed.year);
      if (!yearRow) return [];
      // The current year is partial — pace over its elapsed days, or a WC26
      // window would look like "tournament form" against a 365-day divisor.
      const yearDays =
        ed.year === now.getUTCFullYear()
          ? Math.max((now.getTime() - Date.UTC(ed.year, 0, 1)) / 86_400_000, ed.days)
          : 365;
      const pace = winRaw / ed.days / (rawTotal(yearRow) / yearDays || 1);
      if (pace < ed.formRatio) return [];
      return [{
        key: "wc_golden_ball" as const,
        edition: ed.edition,
        reason: `${pace.toFixed(1)}× the usual pace during the tournament (${ed.span}): ${winRaw.toLocaleString()} contributions in ${ed.days} days.`,
      }];
    }
    // Early-GitHub editions: being active at all was the distinction.
    return [{
      key: "wc_golden_ball" as const,
      edition: ed.edition,
      reason: `${winRaw.toLocaleString()} contributions during the tournament (${ed.span}), back when most devs hadn't even joined GitHub.`,
    }];
  });
}

// ---- Golden Boot -----------------------------------------------------------
// Held on current form: a scoring post + elite shooting. No year attached.

const BOOT_POSITIONS = new Set(["ST", "RW", "CAM"]);
const BOOT_SHO_FLOOR = 80;

function goldenBoot(card: Card): AwardInstance[] {
  if (card.overall < AWARD_OVR_FLOOR) return [];
  if (!BOOT_POSITIONS.has(card.position) || card.stats.sho < BOOT_SHO_FLOOR) return [];
  return [{
    key: "golden_boot",
    reason: `On current form: SHO ${card.stats.sho} as a ${card.position}. The boot stays while the stars keep coming.`,
  }];
}

// ---- World Cup trophy (the Spain gift) -------------------------------------

function worldCup(card: Card): AwardInstance[] {
  if (card.country !== "es") return [];
  return [{
    key: "world_cup",
    edition: "WC26",
    reason: "¡Campeones! Spain lifted the 2026 World Cup. This one belongs to every Spanish profile.",
  }];
}

// ---- Cabinet ---------------------------------------------------------------

/**
 * The full cabinet for a card, in shelf order. `wcWindows` is the optional
 * tournament-window data (one extra query, candidates only) — without it the
 * Golden Ball is simply not judged.
 */
export function computeAwards(card: Card, wcWindows: WcWindowTotals[] = [], now = new Date()): AwardInstance[] {
  return [
    ...worldCup(card),
    ...ballonDors(card),
    ...wcGoldenBalls(card, wcWindows, now),
    ...goldenBoot(card),
  ];
}

/** True when the WC-window query is worth its cost for this card. */
export function wcBallCandidate(card: Card): boolean {
  if (card.overall < AWARD_OVR_FLOOR) return false;
  const years = card.years ?? [];
  return WC_EDITIONS.some((ed) => years.some((y) => y.year === ed.year && rawTotal(y) > 0));
}

/** Cabinet grouped for display: one shelf slot per award type, instances inside. */
export interface AwardGroup {
  key: AwardKey;
  instances: AwardInstance[];
}

const SHELF_ORDER: readonly AwardKey[] = ["world_cup", "ballon_dor", "wc_golden_ball", "golden_boot"];

export function groupAwards(awards: AwardInstance[] = []): AwardGroup[] {
  return SHELF_ORDER.flatMap((key) => {
    const instances = awards.filter((a) => a.key === key);
    return instances.length ? [{ key, instances }] : [];
  });
}
