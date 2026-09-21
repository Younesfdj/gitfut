import { describe, expect, it } from "vitest";
import { buildContributionPanel, type ContributionDay } from "@/lib/contributions";

// buildContributionPanel is the pure calendar -> panel-data transform behind
// ContributionPanel: real per-day counts in, a rendering-ready grid + summary
// stats out. No React, no fetching — so every case below is pinned exactly.

const day = (date: string, count: number): ContributionDay => ({ date, count });

describe("buildContributionPanel — empty input", () => {
  it("returns the empty sentinel for no days at all", () => {
    expect(buildContributionPanel([])).toEqual({
      weeks: [],
      monthLabels: [],
      total: 0,
      currentStreak: 0,
      latestDate: null,
    });
  });

  it("returns a fresh object each call, not a shared reference a caller could mutate", () => {
    expect(buildContributionPanel([])).not.toBe(buildContributionPanel([]));
  });

  it("still produces a real (non-empty) grid when every day is 0 — distinct from no data at all", () => {
    const data = buildContributionPanel([day("2026-03-02", 0), day("2026-03-03", 0)]);
    expect(data.weeks.length).toBeGreaterThan(0);
    expect(data.total).toBe(0);
    expect(data.currentStreak).toBe(0);
  });
});

describe("buildContributionPanel — grid padding + weekday alignment", () => {
  it("pads a single day out to a full Sun..Sat week, placed at its real weekday", () => {
    // 2026-06-17 is a Wednesday -> index 3 of a Sun-first week.
    const data = buildContributionPanel([day("2026-06-17", 5)]);
    expect(data.weeks).toHaveLength(1);
    const week = data.weeks[0];
    expect(week.map((c) => c?.date ?? null)).toEqual([null, null, null, "2026-06-17", null, null, null]);
    expect(week[3]).toMatchObject({ date: "2026-06-17", count: 5, level: 1 });
    expect(data.latestDate).toBe("2026-06-17");
  });
});

describe("buildContributionPanel — level bucketing (quartiles of the user's own active days)", () => {
  it("bands levels 1-3 at the exact quartile boundaries, and pins that the max value lands in level 3 (not 4)", () => {
    // Active counts [1,2,3,4] -> quartiles q1=2, q2=3, q3=4 (25/50/75th of 4
    // sorted values). Because q3 equals the max itself here, no count is
    // ever "> q3" — level 4 is reachable only with more active days spread
    // further above the 75th percentile. Surprising but correct, so pin it.
    const days = [day("2026-01-01", 1), day("2026-01-02", 2), day("2026-01-03", 3), day("2026-01-04", 4)];
    const data = buildContributionPanel(days);
    const levels = data.weeks.flat().filter((c): c is NonNullable<typeof c> => c !== null && c.count > 0);
    expect(levels.map((c) => [c.date, c.level])).toEqual([
      ["2026-01-01", 1],
      ["2026-01-02", 1],
      ["2026-01-03", 2],
      ["2026-01-04", 3],
    ]);
  });

  it("gives every active day level 1 when they're all equal (no spread to band)", () => {
    const days = [day("2026-01-01", 3), day("2026-01-02", 0), day("2026-01-03", 3)];
    const data = buildContributionPanel(days);
    const active = data.weeks.flat().filter((c) => c && c.count > 0);
    expect(active.every((c) => c!.level === 1)).toBe(true);
  });
});

describe("buildContributionPanel — month labels", () => {
  it("emits one label per month, at the week column where that month first appears", () => {
    const days: ContributionDay[] = [];
    for (let d = 28; d <= 31; d++) days.push(day(`2026-01-${d}`, 1)); // Wed..Sat
    for (let d = 1; d <= 6; d++) days.push(day(`2026-02-0${d}`, 1)); // Sun..Fri
    const data = buildContributionPanel(days);
    expect(data.weeks).toHaveLength(2);
    expect(data.monthLabels).toEqual([
      { weekIndex: 0, label: "Jan" },
      { weekIndex: 1, label: "Feb" },
    ]);
  });
});

describe("buildContributionPanel — streaks and totals", () => {
  const RUN = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07"];

  it("sums every count, ignoring zero days", () => {
    const data = buildContributionPanel(RUN.map((d, i) => day(d, [1, 2, 0, 3, 0, 1][i])));
    expect(data.total).toBe(7);
  });

  it("counts the current streak as the trailing run of active days ending at the last tracked day", () => {
    // 1,1,0,1,1,1 -> the trailing 1,1,1 (length 3) is the current streak.
    const data = buildContributionPanel(RUN.map((d, i) => day(d, [1, 1, 0, 1, 1, 1][i])));
    expect(data.currentStreak).toBe(3);
  });

  it("zeroes the current streak the moment the most recent day is inactive, even mid-run elsewhere", () => {
    const data = buildContributionPanel(RUN.map((d, i) => day(d, [1, 1, 1, 1, 1, 0][i])));
    expect(data.currentStreak).toBe(0); // broken as of the last day, despite the earlier 5-day run
  });
});
