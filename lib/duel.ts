import type { Card, StatKey } from "./scoring/types";
import { METRIC_LABELS } from "./scoring/attributes";
import { STATS } from "./scoring/constants";
import { t } from "./i18n/t";
import type { Locale } from "./i18n";

export type DuelSide = "challenger" | "opponent";

export interface DuelRow {
  key: StatKey;
  label: string;
  challenger: number;
  opponent: number;
  /** Higher value takes the row; equal values score for neither side. */
  winner: DuelSide | null;
}

export interface DuelReceipt {
  label: string;
  challenger: number;
  opponent: number;
}

export interface Duel {
  challenger: Card;
  opponent: Card;
  rows: DuelRow[];
  score: Record<DuelSide, number>;
  /** null = Draw. */
  winner: DuelSide | null;
  /** true when a level Scoreline was decided by Overall (penalties). */
  onPenalties: boolean;
  /** Same login in both corners — a training match, always a Draw. */
  training: boolean;
  receipts: DuelReceipt[];
  /** Playstyle names both sides earned (shared traits strip). */
  sharedPlaystyles: string[];
}

/**
 * Receipt metrics are looked up by EN METRIC_LABELS key (the canonical
 * vocabulary), and the locale-specific label is applied at render time via
 * `t.duelReceiptLabel(k, locale)`. We keep the EN string here as the lookup
 * key so the rest of the duel pipeline (computeDuel receipts) doesn't need
 * to know about locales at all.
 */
const RECEIPT_KEYS = [
  "commits",
  "starsEarned",
  "pullRequests",
  "followers",
  "codeReviews",
  "contributions",
] as const;

const metricValue = (card: Card, label: string): number =>
  card.report.metrics.find((m) => m.label === label)?.value ?? 0;

// Winner-counting rule for a set of rows: how many each side has taken. The
// single source for the scoreline — computeDuel tallies the full six, DuelView
// tallies the rows the shootout has revealed so far for the live scoreboard.
export function tallyRows(rows: DuelRow[]): { a: number; b: number } {
  return {
    a: rows.filter((r) => r.winner === "challenger").length,
    b: rows.filter((r) => r.winner === "opponent").length,
  };
}

// Dominance (see CONTEXT.md) — how one-sided the duel reads. Scoreline-first:
// row wins carry most of the bar, stat margins season the rest, so a rout of
// narrow edges reads softer than a massacre but a 1–5 can NEVER show the loser
// as dominant. (Raw totals failed — FUT stats bunch ~45–95, every duel read
// ~50/50; pure margins failed too — one +21 blowout row nearly cancelled five
// narrow losses.) A won row's margin share is at least half, so the blend
// provably lands on the Scoreline winner's side of 50.
const FULL_ROW_GAP = 20; // a stat gap this big owns its row outright
const ROW_WEIGHT = 0.7; // the scoreline drives; margins season

export function dominanceShare(rows: DuelRow[]): number {
  if (rows.length === 0) return 50;
  const { a, b } = tallyRows(rows);
  const rowShare = (a + (rows.length - a - b) / 2) / rows.length;
  const marginShare =
    rows.reduce(
      (t, r) =>
        t +
        0.5 +
        Math.max(
          -0.5,
          Math.min(0.5, (r.challenger - r.opponent) / (2 * FULL_ROW_GAP)),
        ),
      0,
    ) / rows.length;
  return Math.round((ROW_WEIGHT * rowShare + (1 - ROW_WEIGHT) * marginShare) * 100);
}

export function computeDuel(challenger: Card, opponent: Card, locale: Locale = "en"): Duel {
  const training =
    challenger.login.toLowerCase() === opponent.login.toLowerCase();

  const rows: DuelRow[] = STATS.map((key) => {
    const a = challenger.stats[key];
    const b = opponent.stats[key];
    return {
      key,
      label: t.duelStatRow(key, locale),
      challenger: a,
      opponent: b,
      winner: a === b ? null : a > b ? "challenger" : "opponent",
    };
  });

  const tally = tallyRows(rows);
  const score: Record<DuelSide, number> = {
    challenger: tally.a,
    opponent: tally.b,
  };

  // Scoreline first; penalties (Overall) only when level; Draw when both level.
  let winner: DuelSide | null = null;
  let onPenalties = false;
  if (!training) {
    if (score.challenger !== score.opponent) {
      winner = score.challenger > score.opponent ? "challenger" : "opponent";
    } else if (challenger.overall !== opponent.overall) {
      winner =
        challenger.overall > opponent.overall ? "challenger" : "opponent";
      onPenalties = true;
    }
  }

  const receipts: DuelReceipt[] = RECEIPT_KEYS.map((key) => ({
    // Localized label, but key the metric lookup off the canonical English
    // label so the metric-find below keeps working without a second pass.
    label: t.duelReceiptLabel(key, locale),
    challenger: metricValue(challenger, METRIC_LABELS[key]),
    opponent: metricValue(opponent, METRIC_LABELS[key]),
  }));

  const opponentStyles = new Set(opponent.report.playstyles.map((p) => p.name));
  const sharedPlaystyles = challenger.report.playstyles
    .map((p) => p.name)
    .filter((name) => opponentStyles.has(name));

  return {
    challenger,
    opponent,
    rows,
    score,
    winner,
    onPenalties,
    training,
    receipts,
    sharedPlaystyles,
  };
}
