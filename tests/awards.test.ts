import { describe, expect, it } from "vitest";
import { AWARDS, earnedAwards, qualifyingStat } from "@/lib/awards";
import type { Card } from "@/lib/scoring/types";

// Trophy thresholds are product rules the shelf, duel cabinets and modal all
// share — these lock the boundaries and the earned-set composition.

const card = (overall: number, sho = 0, def = 0): Card =>
  ({ overall, stats: { sho, def } }) as Card;

describe("earnedAwards thresholds", () => {
  it("awards the World Cup at OVR 85, not below", () => {
    expect(earnedAwards(card(85)).map((a) => a.key)).toContain("world_cup");
    expect(earnedAwards(card(84)).map((a) => a.key)).not.toContain("world_cup");
  });

  it("awards the Golden Boot at SHO 80, not below", () => {
    expect(earnedAwards(card(0, 80)).map((a) => a.key)).toContain("golden_boot");
    expect(earnedAwards(card(0, 79)).map((a) => a.key)).not.toContain("golden_boot");
  });

  it("awards the Golden Glove at DEF 60, not below", () => {
    expect(earnedAwards(card(0, 0, 60)).map((a) => a.key)).toContain("golden_glove");
    expect(earnedAwards(card(0, 0, 59)).map((a) => a.key)).not.toContain("golden_glove");
  });

  it("returns nothing for a card below every bar, everything for one above all", () => {
    expect(earnedAwards(card(84, 79, 59))).toEqual([]);
    expect(earnedAwards(card(85, 80, 60)).map((a) => a.key)).toEqual([
      "world_cup",
      "golden_boot",
      "golden_glove",
    ]);
  });

  it("keeps cabinet order stable regardless of which stats qualify", () => {
    // Glove + Cup but no Boot: order must still follow AWARDS, not stat size.
    expect(earnedAwards(card(90, 0, 99)).map((a) => a.key)).toEqual(["world_cup", "golden_glove"]);
  });
});

describe("qualifyingStat", () => {
  it("renders the card's stat against the award's requirement", () => {
    const cup = AWARDS.find((a) => a.key === "world_cup")!;
    expect(qualifyingStat(cup, card(87))).toBe("OVR 87 (requires ≥ 85)");
    const glove = AWARDS.find((a) => a.key === "golden_glove")!;
    expect(qualifyingStat(glove, card(0, 0, 61))).toBe("DEF 61 (requires ≥ 60)");
  });
});
