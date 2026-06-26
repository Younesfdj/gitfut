import { buildCard } from "@/lib/scoring/engine";
import type { Card, Signals } from "@/lib/scoring/types";

// Home-fan sample cards: torvalds is real (captured), the other three are
// fabricated to show off the tier range (TOTY / gold / silver). Their stats are
// hand-tuned so the engine derives the intended finish, and their avatars are
// real avatars.githubusercontent.com URLs borrowed from random profiles (the
// names/stats are fake). The github.com/<login>.png redirect form fails the
// <img crossOrigin> check, so always use the avatars.githubusercontent.com form.

type SampleInput = Omit<Signals, "recent_spike" | "topLanguage">;

// Defaults recent_spike and derives topLanguage from the sample's rankedLanguages
// (so the home-fan cards show a language logo without restating the #1 twice).
const make = (o: SampleInput): Signals => ({
  ...o,
  recent_spike: false,
  topLanguage: o.rankedLanguages?.[0] ?? null,
});

const RAW: Signals[] = [
  make({
    login: "torvalds",
    avatarUrl: "https://avatars.githubusercontent.com/u/1024025?s=480&v=4",
    name: "Linus Torvalds",
    location: "Portland, OR",
    followers: 308594,
    account_age_years: 14.8,
    public_repos: 9,
    total_stars_owned: 248723,
    max_repo_stars: 237421,
    languages: 2,
    rankedLanguages: ["C", "Assembly"],
    recent_contributions: 3187,
    active_days_recent: 356,
    active_years: 7,
    total_contributions_lifetime: 37367,
    prs_to_others: 0,
    reviews: 2,
    issues_closed: 2,
    recent_commits: 3120,
  }),
  // TOTY — high magnitude + high legacy (overall 85-89, L >= 0.5)
  make({
    login: "mrivas",
    avatarUrl: "https://avatars.githubusercontent.com/u/121766?s=480&u=c9234b2a786d4d3722ab876563eb63069cd54959&v=4",
    name: "Mateo Rivas",
    location: "Buenos Aires, Argentina",
    followers: 400,
    account_age_years: 4,
    public_repos: 28,
    total_stars_owned: 500,
    max_repo_stars: 500,
    languages: 5,
    rankedLanguages: ["TypeScript", "Go", "Python", "Shell", "CSS"],
    recent_contributions: 700,
    active_days_recent: 160,
    active_years: 5,
    total_contributions_lifetime: 1600,
    prs_to_others: 45,
    reviews: 25,
    issues_closed: 18,
    recent_commits: 560,
  }),
  // GOLD — big project, low social legacy (overall 75-84, L < 0.5)
  make({
    login: "kholt",
    avatarUrl: "https://avatars.githubusercontent.com/u/376661?s=480&u=69e0f4e7e2dc9e575ef93b329babfa773302622e&v=4",
    name: "Kasper Holt",
    location: "Copenhagen, Denmark",
    followers: 150,
    account_age_years: 1.5,
    public_repos: 22,
    total_stars_owned: 5000,
    max_repo_stars: 4200,
    languages: 5,
    rankedLanguages: ["Rust", "TypeScript", "Go", "C++", "Lua"],
    recent_contributions: 1800,
    active_days_recent: 220,
    active_years: 2,
    total_contributions_lifetime: 4000,
    prs_to_others: 60,
    reviews: 25,
    issues_closed: 20,
    recent_commits: 1600,
  }),
  // SILVER — modest all round (overall 65-74)
  make({
    login: "dsol",
    avatarUrl: "https://avatars.githubusercontent.com/u/25254?s=480&u=d332bdd6d335df9f08e7cdac0e17143d898ec70d&v=4",
    name: "Diego Sol",
    location: "Madrid, Spain",
    followers: 30,
    account_age_years: 1.2,
    public_repos: 14,
    total_stars_owned: 250,
    max_repo_stars: 150,
    languages: 4,
    rankedLanguages: ["Python", "JavaScript", "HTML", "CSS"],
    recent_contributions: 300,
    active_days_recent: 90,
    active_years: 1,
    total_contributions_lifetime: 600,
    prs_to_others: 18,
    reviews: 8,
    issues_closed: 10,
    recent_commits: 250,
  }),
];

export const SAMPLE_CARDS: Card[] = RAW.map(buildCard);
export const SAMPLE_LOGINS = RAW.map((r) => r.login);
