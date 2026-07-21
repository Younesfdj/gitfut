import { describe, expect, it } from "vitest";
import { signalsFromPayload } from "@/lib/github/signals";
import type { RawPayload, RawRepo } from "@/lib/github/client";

// The language signal is scored over `languageRepos` (owned ∪ recently-contributed
// public repos, deduped in the client) — NOT the owned-only `repos`, which now
// drives only the star signals. These tests pin that decoupling: a dev with no
// owned public repos but real contributions still gets a language profile.

const repo = (over: Partial<RawRepo> = {}): RawRepo => ({
  stars: 0,
  language: null,
  createdAt: "2021-01-01T00:00:00Z",
  pushedAt: "2021-01-01T00:00:00Z",
  ...over,
});

const payload = (over: Partial<RawPayload> = {}): RawPayload => ({
  login: "someuser",
  name: null,
  avatarUrl: "",
  location: null,
  createdAt: "2020-01-01T00:00:00Z",
  followers: 0,
  publicRepos: 0,
  repos: [],
  languageRepos: [],
  recentCommits: 0,
  recentPRs: 0,
  recentReviews: 0,
  recentIssues: 0,
  recentRestricted: 0,
  recentActiveDays: 0,
  lifetimeContributions: 0,
  activeYears: 0,
  ...over,
});

const NOW = Date.parse("2026-07-03T12:00:00Z");

describe("signalsFromPayload — language diversity", () => {
  it("counts distinct languages from languageRepos and ranks by repo count", () => {
    const s = signalsFromPayload(
      payload({ languageRepos: [{ language: "Go" }, { language: "Go" }, { language: "Rust" }, { language: null }] }),
      NOW,
    );
    expect(s.languages).toBe(2); // Go, Rust — nulls ignored
    expect(s.rankedLanguages).toEqual(["Go", "Rust"]); // Go leads 2:1
    expect(s.topLanguage).toBe("Go");
  });

  it("scores languages from contributions even with NO owned public repos (the org-dev case)", () => {
    // repos is empty (nothing owned/public), but the user commits to org repos.
    const s = signalsFromPayload(
      payload({ repos: [], languageRepos: [{ language: "JavaScript" }, { language: "TypeScript" }] }),
      NOW,
    );
    expect(s.languages).toBe(2);
    expect(s.topLanguage).toBe("JavaScript"); // count tie broken by name asc
  });

  it("does NOT count languages from `repos` — that list only feeds the star signals now", () => {
    const s = signalsFromPayload(
      payload({ repos: [repo({ stars: 12, language: "Python" })], languageRepos: [] }),
      NOW,
    );
    expect(s.total_stars_owned).toBe(12); // stars still come from repos
    expect(s.max_repo_stars).toBe(12);
    expect(s.languages).toBe(0); // but languages come only from languageRepos
    expect(s.topLanguage).toBeNull();
    expect(s.rankedLanguages).toEqual([]);
  });

  it("keeps the markup/styling demotion when ranking the union", () => {
    const s = signalsFromPayload(
      payload({ languageRepos: [{ language: "CSS" }, { language: "CSS" }, { language: "Python" }] }),
      NOW,
    );
    expect(s.languages).toBe(2); // CSS still *counts*…
    expect(s.topLanguage).toBe("Python"); // …but a real language headlines
  });

  it("reports 0 languages and no top language for an empty union", () => {
    const s = signalsFromPayload(payload({ languageRepos: [] }), NOW);
    expect(s.languages).toBe(0);
    expect(s.rankedLanguages).toEqual([]);
    expect(s.topLanguage).toBeNull();
  });
});

describe("signalsFromPayload — active contribution years", () => {
  const yearsFrom = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, index) => start + index);

  it("uses annual contribution activity instead of owned-repository dates", () => {
    const contributionYears = yearsFrom(2021, 2026);
    const ownedRepoYears = new Set([contributionYears[0], ...contributionYears.slice(-3)]);
    const repos = [...ownedRepoYears].map((year) =>
      repo({
        createdAt: `${year}-01-01T00:00:00Z`,
        pushedAt: `${year}-12-01T00:00:00Z`,
      }),
    );

    const s = signalsFromPayload(payload({ repos, activeYears: contributionYears.length }), NOW);

    expect(s.active_years).toBe(contributionYears.length);
    expect(s.active_years).not.toBe(ownedRepoYears.size);
  });

  it("preserves zero when GitHub reports no active contribution years", () => {
    const s = signalsFromPayload(payload({ repos: [repo()], activeYears: 0 }), NOW);

    expect(s.active_years).toBe(0);
  });

  it("allows activity in every inclusive calendar year for late-year accounts", () => {
    const contributionYears = yearsFrom(2021, 2026);
    const s = signalsFromPayload(
      payload({
        createdAt: "2021-12-31T23:59:59Z",
        activeYears: contributionYears.length,
      }),
      NOW,
    );

    expect(s.account_age_years).toBeLessThan(contributionYears.length - 1);
    expect(s.active_years).toBe(contributionYears.length);
  });

  it("uses contribution years at the recent-spike decision boundary", () => {
    const contributionYears = yearsFrom(2021, 2026);
    const ownedRepoYears = new Set([contributionYears[0], ...contributionYears.slice(-3)]);
    const lifetimeContributions = 3_600;
    const recentContributions = 1_600;
    const correctedThreshold = 2 * (lifetimeContributions / contributionYears.length);
    const repositoryThreshold = 2 * (lifetimeContributions / ownedRepoYears.size);

    expect(recentContributions).toBeGreaterThan(correctedThreshold);
    expect(recentContributions).toBeLessThanOrEqual(repositoryThreshold);

    const s = signalsFromPayload(
      payload({
        createdAt: "2021-01-01T00:00:00Z",
        activeYears: contributionYears.length,
        lifetimeContributions,
        recentCommits: recentContributions,
      }),
      NOW,
    );

    expect(s.active_years).toBe(contributionYears.length);
    expect(s.recent_spike).toBe(true);
  });
});
