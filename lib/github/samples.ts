import { buildCard } from "@/lib/scoring/engine";
import { computeAwards, type WcWindowTotals } from "@/lib/awards";
import type { Card, Signals, YearBreakdown } from "@/lib/scoring/types";

// Compact literals for the baked per-year history (real data, captured
// 2026-07-21 alongside the other signals).
const yr = (
  year: number,
  commits: number,
  prs: number,
  reviews: number,
  issues: number,
  restricted: number,
): YearBreakdown => ({ year, commits, prs, reviews, issues, restricted });

// Home-fan showcase: four REAL GitHub accounts, so every card resolves to a live
// scout when clicked (no 404s). Signals were captured once and baked here to keep
// the home page fast (no per-load GitHub fetch). Tiers: torvalds / ThePrimeagen /
// Theo Browne = icon, PewDiePie (pewdiepie-archdaemon) = gold.
// Avatars must use the avatars.githubusercontent.com form — the
// github.com/<login>.png redirect fails the <img crossOrigin> check.

const RAW: Signals[] = [
  {
    login: "torvalds",
    name: "Linus Torvalds",
    avatarUrl: "https://avatars.githubusercontent.com/u/1024025?s=480&v=4",
    location: "Portland, OR",
    followers: 309140,
    account_age_years: 14.82,
    public_repos: 9,
    total_stars_owned: 249244,
    max_repo_stars: 237884,
    languages: 2,
    rankedLanguages: ["C", "OpenSCAD"],
    topLanguage: "C",
    recent_contributions: 3259,
    active_days_recent: 354,
    active_years: 7,
    total_contributions_lifetime: 37435,
    prs_to_others: 0,
    reviews: 2,
    issues_closed: 2,
    recent_commits: 3255,
    recent_spike: false,
    years: [
      yr(2011, 2085, 0, 0, 0, 0), yr(2012, 2289, 0, 0, 0, 0), yr(2013, 2046, 0, 0, 0, 0),
      yr(2014, 2086, 0, 0, 0, 0), yr(2015, 2009, 0, 0, 1, 0), yr(2016, 2275, 0, 0, 0, 0),
      yr(2017, 2314, 15, 0, 0, 0), yr(2018, 2176, 17, 3, 1, 0), yr(2019, 2382, 18, 1, 0, 0),
      yr(2020, 2635, 20, 6, 0, 0), yr(2021, 2415, 4, 6, 0, 0), yr(2022, 2601, 6, 7, 3, 0),
      yr(2023, 2506, 2, 1, 1, 0), yr(2024, 2888, 3, 1, 0, 0), yr(2025, 2922, 0, 0, 1, 0),
      yr(2026, 1789, 0, 2, 2, 0),
    ],
  },
  {
    login: "ThePrimeagen",
    name: "ThePrimeagen",
    avatarUrl:
      "https://avatars.githubusercontent.com/u/4458174?s=480&u=f59d4f5b38134faff67b8a231591f1288ba51a8e&v=4",
    location: "9th Ring, Vim",
    followers: 49389,
    account_age_years: 13.11,
    public_repos: 193,
    total_stars_owned: 42402,
    max_repo_stars: 9126,
    languages: 18,
    rankedLanguages: ["Rust", "TypeScript", "JavaScript", "Lua", "Go"],
    topLanguage: "Rust",
    recent_contributions: 2838,
    active_days_recent: 161,
    active_years: 10,
    total_contributions_lifetime: 10648,
    prs_to_others: 5,
    reviews: 9,
    issues_closed: 15,
    recent_commits: 2809,
    recent_spike: true,
    years: [
      yr(2013, 73, 1, 0, 0, 0), yr(2014, 53, 4, 0, 2, 43), yr(2015, 1724, 224, 0, 77, 88),
      yr(2016, 269, 33, 0, 10, 164), yr(2017, 9, 1, 0, 1, 666), yr(2018, 5, 2, 1, 2, 148),
      yr(2019, 42, 1, 0, 1, 128), yr(2020, 526, 37, 12, 24, 78), yr(2021, 633, 75, 46, 44, 64),
      yr(2022, 720, 8, 9, 7, 78), yr(2023, 510, 9, 28, 22, 64), yr(2024, 358, 166, 4, 0, 68),
      yr(2025, 441, 0, 0, 1, 42), yr(2026, 202, 5, 9, 15, 3697),
    ],
  },
  {
    login: "pewdiepie-archdaemon",
    name: "PewDiePie",
    avatarUrl:
      "https://avatars.githubusercontent.com/u/229018391?s=480&u=0f3337c9b1a009413123495fab8f16b924d394d1&v=4",
    location: null,
    followers: 31258,
    account_age_years: 0.83,
    public_repos: 2,
    total_stars_owned: 82126,
    max_repo_stars: 78827,
    languages: 2,
    rankedLanguages: ["Python", "Shell"],
    topLanguage: "Python",
    recent_contributions: 810,
    active_days_recent: 26,
    active_years: 1,
    total_contributions_lifetime: 810,
    prs_to_others: 8,
    reviews: 233,
    issues_closed: 3,
    recent_commits: 566,
    recent_spike: false,
    years: [yr(2025, 127, 0, 0, 0, 0), yr(2026, 575, 9, 233, 3, 0)],
  },
  {
    login: "t3dotgg",
    name: "Theo Browne",
    avatarUrl:
      "https://avatars.githubusercontent.com/u/6751787?s=480&u=69a6486b20fc980615e51457f6a5b56103cea295&v=4",
    location: "San Francisco, CA",
    followers: 18995,
    account_age_years: 12.35,
    public_repos: 101,
    total_stars_owned: 10950,
    max_repo_stars: 6348,
    languages: 11,
    rankedLanguages: ["TypeScript", "JavaScript", "Astro", "C", "CSS"],
    topLanguage: "TypeScript",
    recent_contributions: 1580,
    active_days_recent: 200,
    active_years: 12,
    total_contributions_lifetime: 12826,
    prs_to_others: 77,
    reviews: 11,
    issues_closed: 4,
    recent_commits: 1488,
    recent_spike: false,
    years: [
      yr(2014, 20, 0, 0, 0, 0), yr(2015, 135, 1, 0, 23, 136), yr(2016, 189, 20, 6, 34, 110),
      yr(2017, 17, 3, 4, 4, 29), yr(2018, 1, 1, 0, 0, 11), yr(2019, 16, 2, 0, 0, 103),
      yr(2020, 72, 3, 1, 0, 91), yr(2021, 648, 43, 4, 20, 2987), yr(2022, 655, 58, 34, 25, 1564),
      yr(2023, 621, 174, 130, 33, 555), yr(2024, 360, 67, 27, 7, 430), yr(2025, 379, 40, 7, 6, 1795),
      yr(2026, 301, 83, 7, 3, 1489),
    ],
  },
];

// Real WC-tournament-window totals for the samples (same capture), so the demo
// cabinets carry genuine Golden Balls without a scout-time query.
const wcWin = (
  edition: string,
  year: number,
  commits: number,
  prs: number,
  reviews: number,
  issues: number,
  restricted: number,
): WcWindowTotals => ({ edition, year, commits, prs, reviews, issues, restricted });

const SAMPLE_WC: Record<string, WcWindowTotals[]> = {
  torvalds: [
    wcWin("South Africa 2010", 2010, 69, 0, 0, 0, 0),
    wcWin("Brazil 2014", 2014, 143, 0, 0, 0, 0),
    wcWin("Russia 2018", 2018, 164, 4, 0, 1, 0),
    wcWin("Qatar 2022", 2022, 256, 0, 0, 0, 0),
    wcWin("North America 2026", 2026, 378, 0, 0, 0, 0),
  ],
  ThePrimeagen: [
    wcWin("Brazil 2014", 2014, 3, 0, 0, 0, 0),
    wcWin("Qatar 2022", 2022, 37, 0, 0, 1, 35),
    wcWin("North America 2026", 2026, 16, 0, 0, 0, 2492),
  ],
  "pewdiepie-archdaemon": [wcWin("North America 2026", 2026, 389, 5, 107, 0, 0)],
  t3dotgg: [
    wcWin("Qatar 2022", 2022, 53, 4, 2, 0, 11),
    wcWin("North America 2026", 2026, 11, 31, 0, 0, 976),
  ],
};

// The capture date pins the partial-2026 pace math, keeping sample cabinets
// deterministic across deploys.
const CAPTURED = new Date("2026-07-21T00:00:00Z");

export const SAMPLE_CARDS: Card[] = RAW.map((s) => {
  const card = buildCard(s);
  card.awards = computeAwards(card, SAMPLE_WC[s.login] ?? [], CAPTURED);
  return card;
});
export const SAMPLE_LOGINS = RAW.map((r) => r.login);
