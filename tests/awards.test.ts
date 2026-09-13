import { describe, expect, it } from "vitest";
import {
  computeAwards,
  groupAwards,
  wcBallCandidate,
  yearScore,
  type WcWindowTotals,
} from "@/lib/awards";
import type { Card, YearBreakdown } from "@/lib/scoring/types";

// The awards engine is pure card+years -> instances; these lock the gates, the
// log physics, the self-relative Ballon d'Or selector and the era-adjusted
// World Cup rules.

const year = (y: number, over: Partial<YearBreakdown> = {}): YearBreakdown => ({
  year: y,
  commits: 0,
  prs: 0,
  reviews: 0,
  issues: 0,
  restricted: 0,
  ...over,
});

const card = (over: Partial<Card> = {}): Card =>
  ({
    overall: 85,
    finish: "gold",
    position: "CM",
    country: "",
    stats: { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 },
    years: [],
    ...over,
  }) as Card;

const keys = (c: Card, wc: WcWindowTotals[] = []) => computeAwards(c, wc).map((a) => a.key);

describe("yearScore log physics", () => {
  it("dampens volume: 10× the commits is nowhere near 10× the score", () => {
    const small = yearScore(year(2020, { commits: 2000 }));
    const spam = yearScore(year(2020, { commits: 20000 }));
    expect(spam).toBeGreaterThan(small);
    expect(spam / small).toBeLessThan(1.4);
  });

  it("rewards breadth: spread beats the same raw total on one axis", () => {
    const spread = yearScore(year(2020, { commits: 800, prs: 80, reviews: 80, issues: 40 }));
    const single = yearScore(year(2020, { commits: 1000 }));
    expect(spread).toBeGreaterThan(single);
  });
});

describe("Ballon d'Or", () => {
  // A career: quiet years around one towering year — the Dembélé shape.
  const spikeYears = [
    year(2019, { commits: 300, issues: 10 }),
    year(2020, { commits: 350, issues: 12 }),
    year(2021, { commits: 4000, prs: 300, reviews: 400, issues: 150 }),
    year(2022, { commits: 320, issues: 9 }),
  ];

  it("awards the spike year, attached to that year, with a reason naming rank and fronts", () => {
    const got = computeAwards(card({ years: spikeYears })).filter((a) => a.key === "ballon_dor");
    expect(got).toHaveLength(1);
    expect(got[0].year).toBe(2021);
    expect(got[0].reason).toContain("× the career-median season");
    expect(got[0].reason).toContain("spread over commits, PRs, reviews and issues");
  });

  it("stays prestigious: a spiky but small year (under 2k contributions) wins nothing", () => {
    // The mawsis case: real breadth, real spike, modest volume.
    const modest = [
      year(2023, { commits: 150, issues: 20 }),
      year(2024, { commits: 300, prs: 60, issues: 48 }),
      year(2025, { commits: 200, issues: 15 }),
      year(2026, { commits: 600, prs: 200, reviews: 80, issues: 39 }),
    ];
    expect(keys(card({ years: modest }))).not.toContain("ballon_dor");
  });

  it("gates on overall rating", () => {
    expect(keys(card({ years: spikeYears, overall: 79 }))).not.toContain("ballon_dor");
  });

  it("gives a flat career nothing — even a spammer's flat 20k-commit career", () => {
    const flat = [2019, 2020, 2021, 2022].map((y) => year(y, { commits: 20000 }));
    expect(keys(card({ years: flat }))).not.toContain("ballon_dor");
  });

  // Escalating career: later years tower over the early median, every one of
  // them a qualifying monster — the pool for the cap and repeat-ladder tests.
  const escalating = [
    year(2016, { commits: 100 }),
    year(2017, { commits: 120 }),
    year(2018, { commits: 150 }),
    year(2019, { commits: 4000, prs: 200, reviews: 300, issues: 100 }),
    year(2020, { commits: 5000, prs: 250, reviews: 350, issues: 120 }),
    year(2021, { commits: 6000, prs: 300, reviews: 400, issues: 140 }),
    year(2022, { commits: 7000, prs: 350, reviews: 450, issues: 160 }),
    year(2023, { commits: 8000, prs: 400, reviews: 500, issues: 180 }),
  ];

  it("repeat trophies demand a stronger profile: OVR 80 holds one, 87 two, 94 three", () => {
    const count = (overall: number) =>
      computeAwards(card({ years: escalating, overall })).filter((a) => a.key === "ballon_dor")
        .length;
    expect(count(80)).toBe(1);
    expect(count(86)).toBe(1);
    expect(count(87)).toBe(2);
    expect(count(93)).toBe(2);
    expect(count(94)).toBe(3);
  });

  it("never exceeds the cap, and icons get one more", () => {
    const gold = computeAwards(card({ years: escalating, finish: "gold", overall: 95 }));
    expect(gold.filter((a) => a.key === "ballon_dor")).toHaveLength(3);
    const icon = computeAwards(card({ years: escalating, finish: "icon", overall: 95 }));
    expect(icon.filter((a) => a.key === "ballon_dor")).toHaveLength(4);
  });

  it("a commits-only legend still wins (no balance requirement)", () => {
    const kernel = [
      year(2019, { commits: 900, restricted: 300 }),
      year(2020, { commits: 950, restricted: 320 }),
      year(2021, { commits: 4500, restricted: 2100 }),
      year(2022, { commits: 1000, restricted: 350 }),
    ];
    const got = computeAwards(card({ years: kernel })).filter((a) => a.key === "ballon_dor");
    expect(got.map((a) => a.year)).toEqual([2021]);
  });

  it("needs history: a single-year account gets none", () => {
    expect(keys(card({ years: [year(2026, { commits: 9000, prs: 500 })] }))).not.toContain("ballon_dor");
  });
});

describe("WC Golden Ball", () => {
  const win = (edition: string, y: number, over: Partial<YearBreakdown> = {}): WcWindowTotals => ({
    ...year(y, over),
    edition,
  });

  it("2010: bare presence wins — being on GitHub then was the distinction", () => {
    const c = card({ years: [year(2010, { commits: 60 }), year(2011, { commits: 80 })] });
    const got = computeAwards(c, [win("South Africa 2010", 2010, { commits: 5 })]);
    expect(got.map((a) => a.edition)).toContain("South Africa 2010");
  });

  it("2022: needs real tournament form, not routine pace", () => {
    // 3650 contributions over the year = 10/day; the 29-day window must beat 1.3×.
    const years = [year(2022, { commits: 3650 })];
    const routine = computeAwards(card({ years }), [win("Qatar 2022", 2022, { commits: 300 })]); // ~10.3/day
    expect(routine.map((a) => a.edition)).not.toContain("Qatar 2022");
    const onFire = computeAwards(card({ years }), [win("Qatar 2022", 2022, { commits: 500 })]); // ~17/day ≈ 1.7×
    expect(onFire.map((a) => a.edition)).toContain("Qatar 2022");
  });

  it("paces the current partial year over elapsed days, not 365", () => {
    // 2026 by late July: ~2000 contributions in ~200 days ≈ 10/day. The WC26
    // window at ~10/day is routine — a 365-day divisor would call it 1.9× form.
    const years = [year(2026, { commits: 2000 })];
    const win26 = win("North America 2026", 2026, { commits: 390 }); // 10/day, clears the floor
    const now = new Date(Date.UTC(2026, 6, 21));
    const got = computeAwards(card({ years }), [win26], now);
    expect(got.map((a) => a.edition)).not.toContain("North America 2026");
  });

  it("modern editions without that year's breakdown are not judged", () => {
    const got = computeAwards(card({ years: [] }), [win("Qatar 2022", 2022, { commits: 900 })]);
    expect(got.map((a) => a.edition)).not.toContain("Qatar 2022");
  });

  it("collects multiple editions", () => {
    const c = card({
      years: [year(2010, { commits: 40 }), year(2022, { commits: 400 })],
    });
    const got = computeAwards(c, [
      win("South Africa 2010", 2010, { commits: 6 }),
      win("Qatar 2022", 2022, { commits: 330 }), // clears the floor, ~11/day vs ~1/day year pace
    ]);
    expect(got.filter((a) => a.key === "wc_golden_ball")).toHaveLength(2);
  });
});

describe("Golden Boot", () => {
  const boot = (position: Card["position"], sho: number, overall = 85) =>
    card({ position, overall, stats: { pac: 70, sho, pas: 70, dri: 70, def: 70, phy: 70 } });

  it("scoring posts only", () => {
    expect(keys(boot("ST", 85))).toContain("golden_boot");
    expect(keys(boot("RW", 85))).toContain("golden_boot");
    expect(keys(boot("CAM", 85))).toContain("golden_boot");
    expect(keys(boot("CB", 99))).not.toContain("golden_boot");
    expect(keys(boot("CDM", 99))).not.toContain("golden_boot");
  });

  it("needs elite shooting and the profile floor", () => {
    expect(keys(boot("ST", 79))).not.toContain("golden_boot");
    expect(keys(boot("ST", 85, 79))).not.toContain("golden_boot");
  });
});

describe("World Cup trophy (Spain gift)", () => {
  it("every Spain-native profile lifts it, no other condition", () => {
    expect(keys(card({ country: "es", overall: 55, finish: "bronze" }))).toContain("world_cup");
  });

  it("everyone else does not", () => {
    expect(keys(card({ country: "fr", overall: 99 }))).not.toContain("world_cup");
    expect(keys(card({ country: "" }))).not.toContain("world_cup");
  });
});

describe("candidacy + grouping", () => {
  it("wcBallCandidate is false below the floor or without WC-year activity", () => {
    expect(wcBallCandidate(card({ overall: 79, years: [year(2022, { commits: 100 })] }))).toBe(false);
    expect(wcBallCandidate(card({ years: [year(2020, { commits: 100 })] }))).toBe(false);
    expect(wcBallCandidate(card({ years: [year(2022, { commits: 100 })] }))).toBe(true);
  });

  it("groups instances per award type in shelf order", () => {
    const groups = groupAwards([
      { key: "golden_boot", reason: "r" },
      { key: "ballon_dor", year: 2020, reason: "r" },
      { key: "ballon_dor", year: 2021, reason: "r" },
    ]);
    expect(groups.map((g) => g.key)).toEqual(["ballon_dor", "golden_boot"]);
    expect(groups[0].instances).toHaveLength(2);
  });
});
