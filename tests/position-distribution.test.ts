import { describe, expect, it } from "vitest";
import { buildCard } from "@/lib/scoring/engine";
import type { Signals } from "@/lib/scoring/types";

// Regression coverage for the DRI/PHY rebalance in lib/scoring/engine.ts: their
// raw-stat floors used to structurally out-score every other stat, so nearly
// any profile collapsed onto Playmaker/CAM (DRI's floor) or, after a partial
// fix, Anchor/CDM (PHY's log term). These tests pin the two things that
// actually matter — genuine signal shape drives family/position, and varied
// profiles don't all collapse onto one family.

const mk = (over: Partial<Signals>): Signals => ({
  login: "x",
  name: "x",
  avatarUrl: "",
  location: null,
  followers: 10,
  account_age_years: 3,
  public_repos: 10,
  total_stars_owned: 2,
  max_repo_stars: 2,
  languages: 4,
  recent_contributions: 50,
  active_days_recent: 50,
  active_years: 3,
  total_contributions_lifetime: 800,
  prs_to_others: 3,
  reviews: 5,
  issues_closed: 5,
  recent_commits: 20,
  recent_spike: false,
  ...over,
});

describe("position distribution — varied signal shapes", () => {
  it("a star/follower-heavy profile becomes a Forward", () => {
    const card = buildCard(mk({ total_stars_owned: 3000, max_repo_stars: 1500, followers: 400 }));
    expect(card.family).toBe("Forward");
    expect(["ST", "RW"]).toContain(card.position);
  });

  it("a language-breadth-heavy profile becomes a Playmaker", () => {
    const card = buildCard(mk({ languages: 15 }));
    expect(card.family).toBe("Playmaker");
    expect(["CM", "CAM"]).toContain(card.position);
  });

  it("a review/issue-heavy profile becomes an Anchor", () => {
    const card = buildCard(mk({ reviews: 200, issues_closed: 100, prs_to_others: 20, followers: 60 }));
    expect(card.family).toBe("Anchor");
    expect(["CB", "CDM"]).toContain(card.position);
  });

  it("does not collapse varied profiles onto a single family (CAM / CDM)", () => {
    const profiles: Signals[] = [
      mk({}), // modest/typical
      mk({ total_stars_owned: 3000, max_repo_stars: 1500, followers: 400 }), // star-magnet
      mk({ languages: 15 }), // polyglot
      mk({ reviews: 200, issues_closed: 100, prs_to_others: 20, followers: 60 }), // heavy-reviewer
      mk({ total_contributions_lifetime: 15000, active_years: 10, account_age_years: 10 }), // long-grinder
      mk({ recent_contributions: 2000, recent_commits: 1500 }), // prolific-committer
      mk({ prs_to_others: 80, followers: 500 }), // connector
      mk({
        followers: 1,
        total_stars_owned: 0,
        max_repo_stars: 0,
        languages: 1,
        reviews: 0,
        issues_closed: 0,
        prs_to_others: 0,
        recent_contributions: 5,
        total_contributions_lifetime: 50,
        active_years: 1,
      }), // low-everything
      mk({
        followers: 100,
        total_stars_owned: 100,
        max_repo_stars: 50,
        languages: 6,
        reviews: 30,
        issues_closed: 20,
        prs_to_others: 15,
        recent_contributions: 400,
        total_contributions_lifetime: 4000,
        active_years: 5,
      }), // balanced-active
      mk({ total_stars_owned: 8000, max_repo_stars: 8000, followers: 20, languages: 2 }), // one-viral-repo
    ];

    const families = profiles.map((s) => buildCard(s).family);
    const positions = profiles.map((s) => buildCard(s).position);

    expect(new Set(families).size).toBeGreaterThan(1);
    expect(new Set(positions).size).toBeGreaterThan(2);
    // no single family should own every profile
    for (const fam of new Set(families)) {
      expect(families.filter((f) => f === fam).length).toBeLessThan(profiles.length);
    }
  });
});
