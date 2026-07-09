import { describe, expect, it } from "vitest";
import { computeDuel, dominanceShare, tallyRows } from "@/lib/duel";
import { duelSequenceFor, resolvedRows } from "@/lib/reveal";
import type { Card, Stats } from "@/lib/scoring/types";

const mkCard = (
  login: string,
  stats: Stats,
  overall: number,
  extras: {
    playstyles?: string[];
    metrics?: { label: string; value: number }[];
  } = {},
): Card => ({
  login,
  name: login,
  avatarUrl: `https://github.com/${login}.png`,
  country: "",
  club: "neutral",
  stats,
  position: "CM",
  family: "Playmaker",
  baseOVR: overall,
  overall,
  finish: "gold",
  finishLabel: "GOLD",
  archetype: "Mezzala",
  archetypeBlurb: "",
  legacy: { L: 0 },
  report: {
    skillMoves: 3,
    weakFoot: 3,
    workRate: { attack: "Med", defense: "Med" },
    style: "Measured",
    reasons: { skillMoves: "", weakFoot: "", workRate: "", style: "" },
    playstyles: (extras.playstyles ?? []).map((name) => ({
      name,
      icon: "star",
      plus: false,
      reason: "",
    })),
    metrics: (extras.metrics ?? []).map((m) => ({ ...m, score: 50 })),
  },
});

const stats = (
  pac: number,
  sho: number,
  pas: number,
  dri: number,
  def: number,
  phy: number,
): Stats => ({
  pac,
  sho,
  pas,
  dri,
  def,
  phy,
});

describe("computeDuel", () => {
  it("most stat wins takes the duel; equal rows score for neither side", () => {
    const a = mkCard("a", stats(90, 90, 90, 90, 10, 50), 80);
    const b = mkCard("b", stats(10, 10, 10, 10, 90, 50), 70);
    const duel = computeDuel(a, b);
    expect(duel.score).toEqual({ challenger: 4, opponent: 1 });
    expect(duel.rows.find((r) => r.key === "phy")?.winner).toBeNull(); // 50 = 50
    expect(duel.winner).toBe("challenger");
    expect(duel.onPenalties).toBe(false);
  });

  it("a 3–3 scoreline goes to penalties: higher overall takes it", () => {
    const a = mkCard("a", stats(90, 90, 90, 10, 10, 10), 70);
    const b = mkCard("b", stats(10, 10, 10, 90, 90, 90), 80);
    const duel = computeDuel(a, b);
    expect(duel.score).toEqual({ challenger: 3, opponent: 3 });
    expect(duel.winner).toBe("opponent");
    expect(duel.onPenalties).toBe(true);
  });

  it("the scoreline outranks overall: a lower-rated card can win the duel", () => {
    const a = mkCard("a", stats(60, 60, 60, 60, 60, 10), 65);
    const b = mkCard("b", stats(50, 50, 50, 50, 50, 95), 90);
    const duel = computeDuel(a, b);
    expect(duel.score).toEqual({ challenger: 5, opponent: 1 });
    expect(duel.winner).toBe("challenger");
    expect(duel.onPenalties).toBe(false);
  });

  it("level scoreline and level overall is a draw", () => {
    const a = mkCard("a", stats(90, 90, 90, 10, 10, 10), 75);
    const b = mkCard("b", stats(10, 10, 10, 90, 90, 90), 75);
    const duel = computeDuel(a, b);
    expect(duel.winner).toBeNull();
    expect(duel.onPenalties).toBe(false);
  });

  it("the same login in both corners is a training match (draw, flagged)", () => {
    const a = mkCard("Same", stats(80, 70, 60, 50, 40, 30), 75);
    const b = mkCard("same", stats(80, 70, 60, 50, 40, 30), 75);
    const duel = computeDuel(a, b);
    expect(duel.training).toBe(true);
    expect(duel.winner).toBeNull();
  });

  it("receipts are the fixed six rows; a metric hidden as zero reads back as 0", () => {
    const a = mkCard("a", stats(50, 50, 50, 50, 50, 50), 70, {
      metrics: [
        { label: "Commits", value: 1200 },
        { label: "Stars earned", value: 300 },
        // "Code reviews" absent — deriveMetrics hid it as a zero
      ],
    });
    const b = mkCard("b", stats(50, 50, 50, 50, 50, 50), 70);
    const duel = computeDuel(a, b);
    expect(duel.receipts.map((r) => r.label)).toEqual([
      "Commits this year",
      "Stars earned",
      "Pull requests",
      "Followers",
      "Code reviews",
      "Lifetime contributions",
    ]);
    // The display label differs from the canonical metric key the value is read
    // back through: "Commits this year" is looked up via METRIC_LABELS.commits.
    expect(
      duel.receipts.find((r) => r.label === "Commits this year")?.challenger,
    ).toBe(1200);
    expect(
      duel.receipts.find((r) => r.label === "Code reviews")?.challenger,
    ).toBe(0);
  });

  it("shared playstyles are the intersection, in the challenger's order", () => {
    const a = mkCard("a", stats(50, 50, 50, 50, 50, 50), 70, {
      playstyles: ["Workhorse", "Star Magnet", "Polyglot"],
    });
    const b = mkCard("b", stats(50, 50, 50, 50, 50, 50), 70, {
      playstyles: ["Polyglot", "Workhorse", "Veteran"],
    });
    expect(computeDuel(a, b).sharedPlaystyles).toEqual([
      "Workhorse",
      "Polyglot",
    ]);
  });
});

describe("tallyRows", () => {
  it("counts winners per side and ignores drawn rows", () => {
    const a = mkCard("a", stats(90, 90, 90, 90, 10, 50), 80);
    const b = mkCard("b", stats(10, 10, 10, 10, 90, 50), 70);
    const { rows } = computeDuel(a, b);
    // phy is 50–50 (a draw), so it counts for neither: 4 + 1 = 5, not 6.
    expect(tallyRows(rows)).toEqual({ a: 4, b: 1 });
  });

  it("tallies a progressive subset — the live scoreboard's rule", () => {
    const a = mkCard("a", stats(90, 90, 90, 90, 10, 50), 80);
    const b = mkCard("b", stats(10, 10, 10, 10, 90, 50), 70);
    const { rows } = computeDuel(a, b);
    // Only the rows the shootout has revealed so far count (first three here).
    expect(tallyRows(rows.slice(0, 3))).toEqual({ a: 3, b: 0 });
    expect(tallyRows([])).toEqual({ a: 0, b: 0 });
  });

  it("agrees with computeDuel's own scoreline over the full set", () => {
    const a = mkCard("a", stats(90, 90, 90, 10, 10, 10), 70);
    const b = mkCard("b", stats(10, 10, 10, 90, 90, 90), 80);
    const duel = computeDuel(a, b);
    expect(tallyRows(duel.rows)).toEqual({
      a: duel.score.challenger,
      b: duel.score.opponent,
    });
  });
});

describe("dominanceShare", () => {
  it("reads a rout as a rout — a 5–1 of narrow edges lands ~78%, not the raw totals' 52%", () => {
    // Torvalds 82/92/87/77/58/95 vs Ferradji 76/89/83/78/47/80 (the 5–1 case
    // where the raw-total split collapsed to 52/48).
    const a = mkCard("torvalds", stats(82, 92, 87, 77, 58, 95), 96);
    const b = mkCard("younesfdj", stats(76, 89, 83, 78, 47, 80), 93);
    expect(dominanceShare(computeDuel(a, b).rows)).toBe(78);
  });

  it("can never sit on the wrong side of the scoreline — one +21 blowout row doesn't outweigh five narrow losses", () => {
    // Oxhouss 70/64/69/70/41/83 vs Abdelrzz9 74/67/80/80/44/62: a 1–5 where the
    // pure-margin metric read 45/55 IN THE LOSER'S FAVOUR. Scoreline-first, it
    // must land well under 50.
    const a = mkCard("oxhouss", stats(70, 64, 69, 70, 41, 83), 74);
    const b = mkCard("abdelrzz9", stats(74, 67, 80, 80, 44, 62), 72);
    const share = dominanceShare(computeDuel(a, b).rows);
    expect(share).toBe(25);
    expect(share).toBeLessThan(50);
  });

  it("is 50 for a dead-even duel and for no resolved rows", () => {
    const a = mkCard("a", stats(70, 70, 70, 70, 70, 70), 75);
    expect(dominanceShare(computeDuel(a, a).rows)).toBe(50);
    expect(dominanceShare([])).toBe(50);
  });

  it("total domination is 100 (or 0 mirrored), never more", () => {
    const a = mkCard("a", stats(99, 99, 99, 99, 99, 99), 90);
    const b = mkCard("b", stats(10, 10, 10, 10, 10, 10), 50);
    expect(dominanceShare(computeDuel(a, b).rows)).toBe(100);
    expect(dominanceShare(computeDuel(b, a).rows)).toBe(0);
  });
});

describe("duel broadcast sequence", () => {
  it("walks out, resolves all six rows in order, stamps, then settles", () => {
    const steps = duelSequenceFor(false);
    expect(steps[0].phase).toEqual({ kind: "walkout" });
    const rowSteps = steps.filter((s) => s.phase.kind === "row");
    expect(
      rowSteps.map((s) => (s.phase.kind === "row" ? s.phase.row : -1)),
    ).toEqual([0, 1, 2, 3, 4, 5]);
    expect(steps[steps.length - 2].phase).toEqual({ kind: "result" });
    expect(steps[steps.length - 1].phase).toEqual({ kind: "settled" });
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].at).toBeGreaterThan(steps[i - 1].at);
    }
  });

  it("reduced motion collapses straight to settled at 0ms", () => {
    expect(duelSequenceFor(true)).toEqual([
      { phase: { kind: "settled" }, at: 0 },
    ]);
  });

  it("resolvedRows maps every phase to the scoreboard's row count", () => {
    expect(resolvedRows({ kind: "walkout" })).toBe(0);
    expect(resolvedRows({ kind: "row", row: 2 })).toBe(3);
    expect(resolvedRows({ kind: "result" })).toBe(6);
    expect(resolvedRows({ kind: "settled" })).toBe(6);
  });
});
