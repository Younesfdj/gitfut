import { describe, expect, it } from "vitest";
import {
  METRIC_LABELS,
  deriveMetrics,
  deriveSkillMoves,
  deriveStyle,
  deriveWeakFoot,
  deriveWorkRate,
} from "@/lib/scoring/attributes";
import type { Signals, Stats } from "@/lib/scoring/types";

// These four attributes are what the scout report actually shows, and each is a
// band lookup — so the tests pin the BOUNDARIES (where an off-by-one silently
// moves someone a whole star) and the PRECEDENCE (deriveStyle returns the first
// rule that matches, so the order of the rules is the behaviour).

const base: Signals = {
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  location: "San Francisco",
  followers: 50,
  account_age_years: 3,
  public_repos: 20,
  total_stars_owned: 100,
  max_repo_stars: 40,
  languages: 5,
  rankedLanguages: ["TypeScript", "Go"],
  topLanguage: "TypeScript",
  recent_contributions: 300,
  active_days_recent: 100,
  active_years: 3,
  total_contributions_lifetime: 1500,
  prs_to_others: 5,
  reviews: 3,
  issues_closed: 4,
  recent_commits: 280,
  recent_spike: false,
  hidden_activity: false,
};

const signals = (over: Partial<Signals> = {}): Signals => ({ ...base, ...over });
const stats = (over: Partial<Stats> = {}): Stats => ({ pac: 60, sho: 60, pas: 60, dri: 60, def: 60, phy: 60, ...over });

describe("deriveSkillMoves", () => {
  it("bands 1–5 on language count, at the boundaries", () => {
    const at = (languages: number) => deriveSkillMoves(signals({ languages, public_repos: 0 })).value;
    expect(at(1)).toBe(1);
    expect(at(2)).toBe(2); // first band up
    expect(at(3)).toBe(2);
    expect(at(4)).toBe(3);
    expect(at(7)).toBe(4);
    expect(at(10)).toBe(5);
    expect(at(30)).toBe(5); // saturates
  });

  it("adds a star for broad output (40+ repos)", () => {
    expect(deriveSkillMoves(signals({ languages: 1, public_repos: 39 })).value).toBe(1);
    expect(deriveSkillMoves(signals({ languages: 1, public_repos: 40 })).value).toBe(2);
  });

  it("never lets the repo bonus push past 5", () => {
    const maxed = deriveSkillMoves(signals({ languages: 30, public_repos: 5_000 }));
    expect(maxed.value).toBe(5);
  });

  it("mentions the repo count only when the bonus actually fired", () => {
    expect(deriveSkillMoves(signals({ languages: 1, public_repos: 40 })).reason).toContain("across 40 repos");
    expect(deriveSkillMoves(signals({ languages: 1, public_repos: 39 })).reason).not.toContain("repos");
  });

  it("pluralises 'language' correctly", () => {
    expect(deriveSkillMoves(signals({ languages: 1, public_repos: 0 })).reason).toContain("1 language.");
    expect(deriveSkillMoves(signals({ languages: 2, public_repos: 0 })).reason).toContain("2 languages.");
  });
});

describe("deriveWeakFoot", () => {
  // Averages the THREE LOWEST stats, so a one-trick profile rates low however
  // high its spike is.
  const weakSideOf = (lows: [number, number, number]) =>
    deriveWeakFoot(stats({ pac: lows[0], sho: lows[1], pas: lows[2], dri: 99, def: 99, phy: 99 }));

  it("bands 1–5 on the three weakest stats, at the boundaries", () => {
    expect(weakSideOf([72, 72, 72]).value).toBe(5);
    expect(weakSideOf([71, 71, 71]).value).toBe(4);
    expect(weakSideOf([63, 63, 63]).value).toBe(4);
    expect(weakSideOf([62, 62, 62]).value).toBe(3);
    expect(weakSideOf([54, 54, 54]).value).toBe(3);
    expect(weakSideOf([53, 53, 53]).value).toBe(2);
    expect(weakSideOf([45, 45, 45]).value).toBe(2);
    expect(weakSideOf([44, 44, 44]).value).toBe(1);
  });

  it("rates a one-trick profile low despite a 99 spike", () => {
    expect(deriveWeakFoot(stats({ sho: 99, pac: 40, pas: 40, dri: 40, def: 40, phy: 40 })).value).toBe(1);
  });

  it("does not mutate the stats it sorts", () => {
    const s = stats({ pac: 90, sho: 10, pas: 50, dri: 70, def: 30, phy: 60 });
    const before = { ...s };
    deriveWeakFoot(s);
    expect(s).toEqual(before);
  });

  it("reports the weak-side average it used", () => {
    expect(weakSideOf([72, 72, 72]).reason).toContain("average 72/99");
  });
});

describe("deriveWorkRate", () => {
  it("bands attack on the PAC/SHO mean, at the boundaries", () => {
    expect(deriveWorkRate(stats({ pac: 68, sho: 68 })).attack).toBe("High");
    expect(deriveWorkRate(stats({ pac: 67, sho: 67 })).attack).toBe("Med");
    expect(deriveWorkRate(stats({ pac: 50, sho: 50 })).attack).toBe("Med");
    expect(deriveWorkRate(stats({ pac: 49, sho: 49 })).attack).toBe("Low");
  });

  it("rounds the mean half-up (67.5 → 68 → High)", () => {
    expect(deriveWorkRate(stats({ pac: 67, sho: 68 })).attack).toBe("High");
  });

  it("bands defense on DEF alone", () => {
    expect(deriveWorkRate(stats({ def: 68 })).defense).toBe("High");
    expect(deriveWorkRate(stats({ def: 50 })).defense).toBe("Med");
    expect(deriveWorkRate(stats({ def: 49 })).defense).toBe("Low");
  });

  it("reads the two sides independently", () => {
    const w = deriveWorkRate(stats({ pac: 90, sho: 90, def: 10 }));
    expect(w).toMatchObject({ attack: "High", defense: "Low" });
  });
});

describe("deriveStyle", () => {
  it("returns Explosive for a recent spike, above everything else", () => {
    // recent_spike wins even when the profile would also read Relentless.
    const s = signals({ recent_spike: true, active_days_recent: 300, recent_contributions: 900 });
    expect(deriveStyle(s).value).toBe("Explosive");
  });

  it("returns Relentless for near-daily, high-volume activity", () => {
    expect(deriveStyle(signals({ active_days_recent: 200, recent_contributions: 800 })).value).toBe("Relentless");
    // one short of either threshold is not Relentless
    expect(deriveStyle(signals({ active_days_recent: 199, recent_contributions: 800 })).value).not.toBe("Relentless");
    expect(deriveStyle(signals({ active_days_recent: 200, recent_contributions: 799 })).value).not.toBe("Relentless");
  });

  it("returns Controlled for a long, steady track record", () => {
    expect(deriveStyle(signals({ account_age_years: 6, active_years: 5 })).value).toBe("Controlled");
  });

  it("returns Clinical for one big hit gone quiet", () => {
    const s = signals({ max_repo_stars: 5_000, recent_contributions: 199, account_age_years: 2, active_years: 1 });
    expect(deriveStyle(s).value).toBe("Clinical");
  });

  // Controlled is checked BEFORE Clinical, so a veteran with a viral repo and a
  // quiet year reads Controlled. Pinning it: the rule order IS the behaviour.
  it("prefers Controlled over Clinical for a quiet veteran with a viral repo", () => {
    const s = signals({ account_age_years: 8, active_years: 6, max_repo_stars: 50_000, recent_contributions: 10 });
    expect(deriveStyle(s).value).toBe("Controlled");
  });

  it("returns Industrious for a steadily active year", () => {
    const s = signals({ recent_contributions: 300, account_age_years: 2, active_years: 1 });
    expect(deriveStyle(s).value).toBe("Industrious");
  });

  it("falls back to Measured for a quiet profile", () => {
    const s = signals({ recent_contributions: 299, account_age_years: 2, active_years: 1, max_repo_stars: 0 });
    expect(deriveStyle(s).value).toBe("Measured");
  });

  it("always ships a reason with the value", () => {
    expect(deriveStyle(signals()).reason).not.toHaveLength(0);
  });
});

describe("deriveMetrics", () => {
  // A profile with every core signal non-zero.
  const full = signals({
    recent_commits: 500,
    total_stars_owned: 900,
    max_repo_stars: 400,
    prs_to_others: 30,
    followers: 250,
    languages: 6,
    issues_closed: 12,
    reviews: 20,
    total_contributions_lifetime: 4_000,
  });

  it("shows all nine core metrics when none are zero", () => {
    const m = deriveMetrics(full);
    expect(m).toHaveLength(9);
    expect(m.map((x) => x.label)).toEqual(Object.values(METRIC_LABELS));
  });

  it("hides zeroed core metrics", () => {
    const m = deriveMetrics(signals({ ...full, reviews: 0 }));
    expect(m.map((x) => x.label)).not.toContain(METRIC_LABELS.codeReviews);
  });

  // One zeroed metric is absorbed silently; beyond that, each further zero pulls
  // in a real optional metric so a sparse card shows data instead of blanks.
  it("backfills one optional metric per zeroed core beyond the first", () => {
    const oneZero = deriveMetrics(signals({ ...full, reviews: 0 }));
    expect(oneZero).toHaveLength(8); // 8 core shown, no filler
    expect(oneZero.every((x) => Object.values(METRIC_LABELS).includes(x.label as never))).toBe(true);

    const threeZeros = deriveMetrics(signals({ ...full, reviews: 0, issues_closed: 0, prs_to_others: 0 }));
    expect(threeZeros).toHaveLength(8); // 6 core + 2 fillers
    expect(threeZeros.map((x) => x.label)).toContain("Account age");
    expect(threeZeros.map((x) => x.label)).toContain("Active days");
  });

  it("never shows a zeroed filler either", () => {
    const bare = signals({
      recent_commits: 0,
      total_stars_owned: 0,
      max_repo_stars: 0,
      prs_to_others: 0,
      followers: 0,
      languages: 0,
      issues_closed: 0,
      reviews: 0,
      total_contributions_lifetime: 0,
      account_age_years: 0,
      active_days_recent: 0,
      public_repos: 0,
      active_years: 0,
    });
    expect(deriveMetrics(bare)).toEqual([]);
  });

  it("scores 0–99 against the elite reference, clamped", () => {
    const [commits] = deriveMetrics(signals({ ...full, recent_commits: 3_000 })); // ref = 3_000
    expect(commits.score).toBe(99);

    // Well past the reference still clamps to 99 rather than overflowing.
    const huge = deriveMetrics(signals({ ...full, total_stars_owned: 5_000_000 }));
    const stars = huge.find((m) => m.label === METRIC_LABELS.starsEarned)!;
    expect(stars.score).toBe(99);
    expect(stars.value).toBe(5_000_000); // the raw count is preserved, only the score is capped
  });

  it("carries the real count and its unit, not just the score", () => {
    const m = deriveMetrics(full).find((x) => x.label === METRIC_LABELS.followers)!;
    expect(m).toMatchObject({ value: 250, unit: "followers" });
  });
});
