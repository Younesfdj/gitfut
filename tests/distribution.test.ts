import { describe, expect, it } from "vitest";
import { formatPct, standing } from "@/lib/distribution";
import { DIST_ACTIVE_COUNTS, DIST_ACTIVE_N, DIST_COUNTS, DIST_MIN, DIST_N } from "@/lib/distribution-data";

// The "TOP 0.02% of GitHub" line under the scouting metrics. It's a claim the app
// makes publicly about someone, computed from a histogram snapshot that gets
// regenerated (scripts/distribution-runner) — so the maths has to stay right for
// a sample of any size, not just today's.

// A tiny histogram: ratings 50..54, one account at each of 50–53 and none at 54.
const COUNTS = [10, 5, 3, 2, 0]; // n = 20
const N = 20;

describe("formatPct", () => {
  it("shows whole numbers from 10 up", () => {
    expect(formatPct(10)).toBe("10");
    expect(formatPct(42.4)).toBe("42");
    expect(formatPct(99.6)).toBe("100");
  });

  it("shows one decimal from 1 to just under 10", () => {
    expect(formatPct(9.96)).toBe("10.0"); // still the one-decimal band
    expect(formatPct(3.25)).toBe("3.3");
    expect(formatPct(1)).toBe("1.0");
  });

  it("shows two decimals below 1", () => {
    expect(formatPct(0.99)).toBe("0.99");
    expect(formatPct(0.016)).toBe("0.02");
  });
});

describe("standing", () => {
  it("counts the sample at or above the rating (inclusive)", () => {
    // ratings 52,53 → 3 + 2 = 5 of 20 = 25%
    expect(standing(COUNTS, N, 52, 50)).toMatchObject({ atOrAbove: 5, pct: 25, bounded: false });
  });

  it("includes the card's own bucket, not just the ones above it", () => {
    expect(standing(COUNTS, N, 53, 50).atOrAbove).toBe(2); // the 53 bucket itself
  });

  it("counts the whole sample for a rating below the histogram floor", () => {
    expect(standing(COUNTS, N, 1, 50)).toMatchObject({ atOrAbove: 20, pct: 100 });
  });

  it("labels a normal standing without the '<'", () => {
    expect(standing(COUNTS, N, 52, 50).label).toBe("Top 25%");
  });

  // Nothing observed at or above → "top 0%" would be a lie. The honest claim is
  // the rule-of-three upper bound, 3/n at 95% confidence.
  describe("when nothing in the sample reaches the rating", () => {
    it("falls back to the rule-of-three bound and marks it bounded", () => {
      const s = standing(COUNTS, N, 54, 50);
      expect(s).toMatchObject({ atOrAbove: 0, bounded: true });
      expect(s.pct).toBeCloseTo((100 * 3) / N); // 15%
    });

    it("shows the bound with a '<' so it doesn't read as measured", () => {
      expect(standing(COUNTS, N, 54, 50).label).toBe("Top < 15%");
    });
  });

  it("makes no claim on an empty sample instead of dividing by zero", () => {
    const s = standing([], 0, 90);
    expect(s.pct).toBe(0);
    expect(Number.isFinite(s.pct)).toBe(true);
  });

  it("defaults the histogram floor to DIST_MIN", () => {
    expect(standing(DIST_COUNTS, DIST_N, 50)).toEqual(standing(DIST_COUNTS, DIST_N, 50, DIST_MIN));
  });
});

describe("standing — against the shipped sample", () => {
  it("puts a floor-rated card at the top of nothing (100% of the sample)", () => {
    expect(standing(DIST_COUNTS, DIST_N, DIST_MIN).pct).toBe(100);
  });

  it("rates an elite card above almost everyone, and bounds a rating nobody reached", () => {
    const elite = standing(DIST_COUNTS, DIST_N, 90);
    expect(elite.pct).toBeLessThan(1);
    expect(elite.bounded).toBe(false); // the sample does reach 90

    const unreached = standing(DIST_COUNTS, DIST_N, 99);
    expect(unreached.bounded).toBe(true); // nothing in the sample is 99
    expect(unreached.label).toBe("Top < 0.02%");
  });

  it("is stricter among active devs than across all of GitHub", () => {
    // The active sample is the tougher crowd, so the same rating is rarer overall.
    const all = standing(DIST_COUNTS, DIST_N, 75);
    const active = standing(DIST_ACTIVE_COUNTS, DIST_ACTIVE_N, 75);
    expect(active.pct).toBeGreaterThan(all.pct);
  });

  it("is monotonic — a higher rating never has a larger share above it", () => {
    let prev = Infinity;
    for (let ovr = DIST_MIN; ovr <= 99; ovr++) {
      const { atOrAbove } = standing(DIST_COUNTS, DIST_N, ovr);
      expect(atOrAbove).toBeLessThanOrEqual(prev);
      prev = atOrAbove;
    }
  });
});
