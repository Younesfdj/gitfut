import { describe, expect, it } from "vitest";
import { isRecentSpike, signalsFromPayload } from "@/lib/github/signals";
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
  recentDaily: [],
  lifetimeContributions: 0,
  years: [],
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

describe("isRecentSpike — the Explosive style", () => {
  const daily = (before: number, last90: number) => [
    ...Array<number>(275).fill(before),
    ...Array<number>(90).fill(last90),
  ];
  const year = (y: number, commits: number) => ({ year: y, commits, prs: 0, reviews: 0, issues: 0, restricted: 0 });

  it("fires on a fresh burst that a whole-year total would smother", () => {
    // ~1/day for the last 90 days vs a usual ~0.3/day (the lifetime rate beats the quiet year's 0.1).
    const d = [...Array<number>(275).fill(0).map((_, i) => (i % 10 === 0 ? 1 : 0)), ...Array<number>(90).fill(1)];
    expect(isRecentSpike(d, [year(2024, 110), year(2025, 120)], NOW)).toBe(true);
  });

  it("does NOT fire on a burst that ended months ago", () => {
    expect(isRecentSpike(daily(3, 0), [], NOW)).toBe(false);
  });

  it("does NOT fire for a steady pace", () => {
    expect(isRecentSpike(daily(2, 2), [], NOW)).toBe(false);
  });

  it("does NOT treat a return to the lifetime pace as a burst", () => {
    expect(isRecentSpike(daily(0, 1), [year(2023, 365), year(2024, 365)], NOW)).toBe(false);
  });

  it("ignores tiny counts after a quiet spell", () => {
    const d = [...Array<number>(355).fill(0), ...Array<number>(10).fill(2)]; // 20 total
    expect(isRecentSpike(d, [], NOW)).toBe(false);
  });

  it("wires through signalsFromPayload", () => {
    expect(signalsFromPayload(payload({ recentDaily: daily(0, 1) }), NOW).recent_spike).toBe(true);
    expect(signalsFromPayload(payload({ recentDaily: daily(1, 0) }), NOW).recent_spike).toBe(false);
  });
});
