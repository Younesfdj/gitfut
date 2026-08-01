import { describe, expect, it } from "vitest";
import { signalsFromPayload } from "@/lib/github/signals";
import type { RawPayload, RawRepo } from "@/lib/github/client";
import type { YearBreakdown } from "@/lib/scoring/types";

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

// `active_years` used to look only at owned-repo created/pushed dates, but `repos`
// is capped at the top-100-by-stars repos — so a prolific dev's earlier/low-star
// years went missing. It now also counts years from the per-year contribution
// breakdown (`years`), which covers every calendar year, taking the larger count.
describe("signalsFromPayload — active_years", () => {
  const yr = (year: number, commits = 1): YearBreakdown => ({
    year,
    commits,
    prs: 0,
    reviews: 0,
    issues: 0,
    restricted: 0,
  });

  it("counts active years from the contribution breakdown, not just owned-repo dates", () => {
    // The (top-100) repos only span 2021; contributions span 2020–2023.
    const s = signalsFromPayload(
      payload({
        createdAt: "2018-01-01T00:00:00Z",
        repos: [repo({ createdAt: "2021-01-01T00:00:00Z", pushedAt: "2021-06-01T00:00:00Z" })],
        years: [yr(2020), yr(2021), yr(2022), yr(2023)],
      }),
      NOW,
    );
    expect(s.active_years).toBe(4); // 4 contribution years, not the 1 the repo dates show
  });

  it("falls back to repo dates when the contribution breakdown is empty", () => {
    const s = signalsFromPayload(
      payload({
        createdAt: "2018-01-01T00:00:00Z",
        repos: [
          repo({ createdAt: "2019-01-01T00:00:00Z", pushedAt: "2020-01-01T00:00:00Z" }),
          repo({ createdAt: "2021-01-01T00:00:00Z", pushedAt: "2021-01-01T00:00:00Z" }),
        ],
        years: [], // every year window failed its retry — omitted, not zeroed
      }),
      NOW,
    );
    expect(s.active_years).toBe(3); // 2019, 2020, 2021 from repo dates
  });

  it("ignores zero-contribution years and never exceeds account age", () => {
    const s = signalsFromPayload(
      payload({
        createdAt: "2025-01-01T00:00:00Z", // ~1.5 yr old at NOW (2026-07)
        years: [yr(2025), yr(2026), yr(2024, 0)], // 2024 has no contributions
      }),
      NOW,
    );
    expect(s.active_years).toBe(2); // two active years, capped at ceil(age) = 2
  });
});
