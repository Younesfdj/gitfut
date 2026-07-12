import { describe, expect, it } from "vitest";
import {
  cardToMeta,
  serializeMeta,
  parseMeta,
  assembleEntries,
  pageBounds,
  neighborBounds,
  sampleSeedEntries,
  type MetaEntry,
} from "@/lib/leaderboard-core";
import type { Card } from "@/lib/scoring/types";

const mkCard = (login: string, overall: number, over: Partial<Card> = {}): Card => ({
  login,
  name: login,
  avatarUrl: `https://avatars.githubusercontent.com/${login}.png`,
  country: "us",
  club: "neutral",
  stats: { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 },
  position: "CM",
  family: "Playmaker",
  baseOVR: overall,
  overall,
  finish: "gold",
  finishLabel: "GOLD",
  archetype: "Mezzala",
  archetypeBlurb: "",
  legacy: { L: 0 },
  topLanguage: "TypeScript",
  languageLogo: { name: "TypeScript", slug: "typescript" },
  report: {
    skillMoves: 3,
    weakFoot: 3,
    workRate: { attack: "Med", defense: "Med" },
    style: "Measured",
    reasons: { skillMoves: "", weakFoot: "", workRate: "", style: "" },
    playstyles: [],
    metrics: [],
  },
  ...over,
});

const meta = (login: string, overall: number): MetaEntry => cardToMeta(mkCard(login, overall));

describe("cardToMeta / serialize / parse", () => {
  it("captures the display fields and survives a JSON round-trip", () => {
    const m = cardToMeta(mkCard("torvalds", 99));
    expect(m).toMatchObject({ login: "torvalds", overall: 99, langSlug: "typescript", topLanguage: "TypeScript" });
    expect(parseMeta(serializeMeta(mkCard("torvalds", 99)))).toEqual(m);
  });

  it("maps a card with no language logo to null slug", () => {
    const m = cardToMeta(mkCard("nolang", 60, { languageLogo: null, topLanguage: null }));
    expect(m.langSlug).toBeNull();
    expect(m.topLanguage).toBeNull();
  });

  it("parseMeta returns null on null / garbage", () => {
    expect(parseMeta(null)).toBeNull();
    expect(parseMeta("not json")).toBeNull();
    expect(parseMeta("{}")).toBeNull();
  });
});

describe("assembleEntries", () => {
  it("assigns sequential ranks from startRank", () => {
    const entries = assembleEntries(["a", "b", "c"], [meta("a", 90), meta("b", 85), meta("c", 80)], 1);
    expect(entries.map((e) => [e.rank, e.login])).toEqual([[1, "a"], [2, "b"], [3, "c"]]);
  });

  it("starts ranks at an arbitrary offset (page 2)", () => {
    const entries = assembleEntries(["k", "l"], [meta("k", 70), meta("l", 69)], 21);
    expect(entries.map((e) => e.rank)).toEqual([21, 22]);
  });

  it("skips members with missing meta but keeps ranks aligned to position", () => {
    const entries = assembleEntries(["a", "b", "c"], [meta("a", 90), null, meta("c", 80)], 1);
    expect(entries.map((e) => [e.rank, e.login])).toEqual([[1, "a"], [3, "c"]]);
  });
});

describe("pageBounds", () => {
  it("computes inclusive ZREVRANGE bounds for page 1", () => {
    expect(pageBounds(1, 20, 100)).toEqual({ start: 0, stop: 19, page: 1, totalPages: 5 });
  });
  it("computes bounds for a middle page", () => {
    expect(pageBounds(3, 20, 100)).toMatchObject({ start: 40, stop: 59, page: 3 });
  });
  it("clamps an out-of-range page to the last page", () => {
    expect(pageBounds(99, 20, 100)).toMatchObject({ page: 5, start: 80, stop: 99 });
  });
  it("clamps a non-positive / NaN page to 1", () => {
    expect(pageBounds(0, 20, 100)).toMatchObject({ page: 1 });
    expect(pageBounds(NaN, 20, 100)).toMatchObject({ page: 1 });
  });
  it("reports at least one page when the board is empty", () => {
    expect(pageBounds(1, 20, 0)).toMatchObject({ page: 1, totalPages: 1, start: 0, stop: 19 });
  });
});

describe("neighborBounds", () => {
  it("windows ±span around a middle rank", () => {
    expect(neighborBounds(50, 3, 100)).toEqual({ start: 47, stop: 53 });
  });
  it("clamps at the top edge", () => {
    expect(neighborBounds(1, 3, 100)).toEqual({ start: 0, stop: 4 });
  });
  it("clamps at the bottom edge", () => {
    expect(neighborBounds(99, 3, 100)).toEqual({ start: 96, stop: 99 });
  });
});

describe("sampleSeedEntries", () => {
  it("ranks the baked sample cards by overall desc with sequential ranks", () => {
    const seed = sampleSeedEntries();
    expect(seed.length).toBeGreaterThan(0);
    expect(seed[0].rank).toBe(1);
    for (let i = 1; i < seed.length; i++) {
      expect(seed[i - 1].overall).toBeGreaterThanOrEqual(seed[i].overall);
      expect(seed[i].rank).toBe(i + 1);
    }
  });
});
