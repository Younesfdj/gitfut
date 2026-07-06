import type { RawPayload } from "./client";
import { rankLanguages } from "./languages";
import type { Signals } from "@/lib/scoring/types";

const YEAR_MS = 31557600000;
const yearOf = (iso: string) => (iso ? new Date(iso).getUTCFullYear() : null);

// Maps the (already real, already flattened) GraphQL payload onto the scoring
// signals. No estimation — every field traces back to a GitHub number.
export function signalsFromPayload(p: RawPayload, now = Date.now()): Signals {
  const account_age_years = Math.max(0, (now - Date.parse(p.createdAt)) / YEAR_MS);

  const total_stars_owned = p.repos.reduce((s, r) => s + r.stars, 0);
  const max_repo_stars = p.repos.reduce((m, r) => Math.max(m, r.stars), 0);
  // Counted over the UNION of owned repos and public repos the user has recently
  // committed to (deduped in the client) — so work in orgs a developer doesn't
  // *own* still counts, instead of a misleading "0 languages" for org/team devs.
  const langs = new Set(p.languageRepos.map((r) => r.language).filter(Boolean) as string[]);
  const languages = langs.size;
  // Primary languages ranked by repo count, programming languages floated above
  // styling/markup (CSS/HTML) — the #1 drives the card's language + logo.
  const rankedLanguages = rankLanguages(p.languageRepos);

  const years = new Set<number>();
  for (const r of p.repos) {
    const c = yearOf(r.createdAt);
    const pushed = yearOf(r.pushedAt);
    if (c) years.add(c);
    if (pushed) years.add(pushed);
  }
  const active_years = Math.min(Math.max(years.size, 1), Math.ceil(account_age_years) || 1);

  // Recent activity over the last year: every contribution type GitHub exposes,
  // including the private (restricted) count, so it matches the profile graph.
  const recent_contributions =
    p.recentCommits + p.recentPRs + p.recentReviews + p.recentIssues + p.recentRestricted;
  const total_contributions_lifetime = p.lifetimeContributions;
  const recent_spike = recent_contributions > 2 * (total_contributions_lifetime / Math.max(active_years, 1));

  return {
    login: p.login,
    name: p.name || p.login,
    avatarUrl: p.avatarUrl || `https://github.com/${p.login}.png?size=480`,
    location: p.location,
    followers: p.followers,
    account_age_years,
    public_repos: p.publicRepos,
    total_stars_owned,
    max_repo_stars,
    languages,
    rankedLanguages,
    topLanguage: rankedLanguages[0] ?? null,
    recent_contributions,
    active_days_recent: p.recentActiveDays,
    active_years,
    total_contributions_lifetime,
    prs_to_others: p.recentPRs,
    reviews: p.recentReviews,
    issues_closed: p.recentIssues,
    // Public commits + the private lump. GitHub gives no private-commit count to
    // third parties (restrictedContributionsCount covers all private activity),
    // so this is the closest "public + private" figure available.
    recent_commits: p.recentCommits + p.recentRestricted,
    recent_spike,
  };
}
