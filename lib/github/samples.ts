import { buildCard } from "@/lib/scoring/engine";
import type { Card, Signals } from "@/lib/scoring/types";

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
    hidden_activity: false,
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
    hidden_activity: false,
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
    hidden_activity: false,
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
    hidden_activity: false,
  },
];

export const SAMPLE_CARDS: Card[] = RAW.map(buildCard);
export const SAMPLE_LOGINS = RAW.map((r) => r.login);
