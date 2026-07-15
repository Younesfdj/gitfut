import { describe, expect, it } from "vitest";
import { derivePlaystyles } from "@/lib/scoring/playstyles";
import type { Signals } from "@/lib/scoring/types";

// Playstyles are earned, not assigned: each fires only when a real signal crosses
// its threshold, so a weak profile shows none. The tests pin the three decisions
// that make the panel — WHICH fire (>= base), WHICH are elite (>= plus), and in
// WHAT ORDER they're shown (elite first, then by how far past base they are).

// Deliberately below every base threshold: this profile earns nothing.
const quiet: Signals = {
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  location: null,
  followers: 10,
  account_age_years: 1,
  public_repos: 3,
  total_stars_owned: 5,
  max_repo_stars: 2,
  languages: 1,
  recent_contributions: 20,
  active_days_recent: 10,
  active_years: 1,
  total_contributions_lifetime: 50,
  prs_to_others: 1,
  reviews: 0,
  issues_closed: 0,
  recent_commits: 18,
  recent_spike: false,
};

const signals = (over: Partial<Signals> = {}): Signals => ({ ...quiet, ...over });
const names = (s: Signals) => derivePlaystyles(s).map((p) => p.name);

describe("derivePlaystyles — qualifying", () => {
  it("gives a quiet profile no playstyles at all", () => {
    expect(derivePlaystyles(quiet)).toEqual([]);
  });

  it("fires exactly on the base threshold (>=, not >)", () => {
    expect(names(signals({ total_stars_owned: 499 }))).not.toContain("Star Magnet");
    expect(names(signals({ total_stars_owned: 500 }))).toContain("Star Magnet");
  });

  it("reads Maintainer off reviews AND issues combined", () => {
    expect(names(signals({ reviews: 20, issues_closed: 9 }))).not.toContain("Maintainer");
    expect(names(signals({ reviews: 20, issues_closed: 10 }))).toContain("Maintainer");
  });

  it("awards each playstyle from its own signal", () => {
    expect(names(signals({ max_repo_stars: 1_000 }))).toContain("Viral Hit");
    expect(names(signals({ active_days_recent: 120 }))).toContain("Workhorse");
    expect(names(signals({ recent_contributions: 500 }))).toContain("Rapid Fire");
    expect(names(signals({ total_contributions_lifetime: 3_000 }))).toContain("Marathoner");
    expect(names(signals({ prs_to_others: 30 }))).toContain("Connector");
    expect(names(signals({ followers: 200 }))).toContain("Magnetic");
    expect(names(signals({ languages: 5 }))).toContain("Polyglot");
    expect(names(signals({ public_repos: 30 }))).toContain("Prolific");
    expect(names(signals({ account_age_years: 5 }))).toContain("Veteran");
  });
});

describe("derivePlaystyles — the elite (PlayStyle+) tier", () => {
  it("marks plus only at the elite threshold", () => {
    const [under] = derivePlaystyles(signals({ followers: 19_999 }));
    expect(under).toMatchObject({ name: "Magnetic", plus: false });

    const [over] = derivePlaystyles(signals({ followers: 20_000 }));
    expect(over).toMatchObject({ name: "Magnetic", plus: true });
  });

  it("sorts every plus above every non-plus", () => {
    // Polyglot is elite (9 languages); Star Magnet clears base but isn't.
    const out = derivePlaystyles(signals({ languages: 9, total_stars_owned: 500 }));
    expect(out.map((p) => p.name)).toEqual(["Polyglot", "Star Magnet"]);
    expect(out.map((p) => p.plus)).toEqual([true, false]);
  });

  it("ranks non-plus playstyles by how far past base they are", () => {
    // Prolific at 10x base outranks Star Magnet at 2x, regardless of raw size.
    const out = names(signals({ public_repos: 300, total_stars_owned: 1_000 }));
    expect(out).toEqual(["Prolific", "Star Magnet"]);
  });
});

describe("derivePlaystyles — the shown list", () => {
  // Clears all 11 base thresholds; only 8 may be shown.
  const everything = signals({
    total_stars_owned: 600,
    max_repo_stars: 1_100,
    active_days_recent: 130,
    recent_contributions: 600,
    total_contributions_lifetime: 3_500,
    reviews: 20,
    issues_closed: 15,
    prs_to_others: 35,
    followers: 250,
    languages: 6,
    public_repos: 35,
    account_age_years: 6,
  });

  it("caps the list at 8 even when all 11 qualify", () => {
    expect(derivePlaystyles(everything)).toHaveLength(8);
  });

  it("keeps an elite playstyle that the ratio sort alone would have cut", () => {
    // Polyglot at exactly 9 languages is elite, but only 1.8x its base — the
    // WEAKEST ratio of the eleven here, so ranking by ratio alone would drop it
    // outside the top 8. The plus-first sort has to float it to the very top.
    const out = derivePlaystyles(
      signals({
        languages: 9, // elite, ratio 1.8x  ← the one at risk
        total_stars_owned: 1_500, // 3.0x
        max_repo_stars: 3_000, // 3.0x
        recent_contributions: 1_500, // 3.0x
        total_contributions_lifetime: 9_000, // 3.0x
        reviews: 45,
        issues_closed: 45, // 3.0x
        prs_to_others: 90, // 3.0x
        followers: 600, // 3.0x
        public_repos: 90, // 3.0x
        active_days_recent: 240, // 2.0x
        account_age_years: 11, // 2.2x
      }),
    );
    expect(out).toHaveLength(8);
    expect(out[0]).toMatchObject({ name: "Polyglot", plus: true });
    expect(out.slice(1).every((p) => !p.plus)).toBe(true);
  });
});

describe("derivePlaystyles — the reason shown on the tooltip", () => {
  it("reads as the real count plus its noun", () => {
    const [p] = derivePlaystyles(signals({ total_stars_owned: 500 }));
    expect(p.reason).toBe("500 stars earned.");
  });

  it("compacts big counts (20000 → 20k)", () => {
    const [p] = derivePlaystyles(signals({ followers: 20_000 }));
    expect(p.reason).toContain("20k followers");
  });

  it("calls out the elite tier, and only for plus", () => {
    const [elite] = derivePlaystyles(signals({ followers: 20_000 }));
    expect(elite.reason).toContain("elite tier");

    const [plain] = derivePlaystyles(signals({ followers: 200 }));
    expect(plain.reason).not.toContain("elite tier");
  });

  it("ships an icon key for the UI to resolve", () => {
    const [p] = derivePlaystyles(signals({ total_stars_owned: 500 }));
    expect(p.icon).toBe("star");
  });
});
