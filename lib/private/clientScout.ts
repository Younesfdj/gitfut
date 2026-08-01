// Browser-side GitHub scout — runs the same GraphQL profile + lifetime pipeline
// as the server's lib/github/client.ts, but from the visitor's own browser with
// their own GitHub token. The token is sent ONLY to api.github.com over HTTPS,
// never to GitFut's servers, never logged, never stored.
//
// Reuses signalsFromPayload + buildCard (both pure, no server-only) so the
// scoring is identical whether scouted server-side or privately.

import type { Card } from "@/lib/scoring/types";
import { signalsFromPayload } from "@/lib/github/signals";
import { buildCard } from "@/lib/scoring/engine";

const ENDPOINT = "https://api.github.com/graphql";
const VALID = /^(?=.*[a-z\d])[a-z\d-]{1,39}$/i;
const GITHUB_EPOCH_YEAR = 2008;
const LIFETIME_BATCH = 4;
const MIN_CONTRIBUTED_LANG_COMMITS = 3;
const REQUEST_TIMEOUT_MS = 15_000; // browser-side can afford a longer timeout

export interface ClientScoutError {
  type: "invalid" | "notfound" | "ratelimit" | "network" | "token";
  message: string;
}

// --- GraphQL response shapes (mirrors server) ---
interface UserNode {
  login: string;
  name: string | null;
  avatarUrl: string;
  location: string | null;
  createdAt: string;
  followers: { totalCount: number };
  repositories: {
    totalCount: number;
    nodes: {
      nameWithOwner: string;
      stargazerCount: number;
      primaryLanguage: { name: string } | null;
      createdAt: string;
      pushedAt: string;
    }[];
  };
  recent: {
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalIssueContributions: number;
    restrictedContributionsCount: number;
    commitContributionsByRepository: {
      contributions: { totalCount: number };
      repository: {
        nameWithOwner: string;
        isFork: boolean;
        isPrivate: boolean;
        primaryLanguage: { name: string } | null;
      };
    }[];
    contributionCalendar: { weeks: { contributionDays: { contributionCount: number }[] }[] };
  };
}

interface YearContrib {
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  restrictedContributionsCount: number;
}

// Matches the server's RawPayload shape — feeds into signalsFromPayload.
interface RawRepo {
  stars: number;
  language: string | null;
  createdAt: string;
  pushedAt: string;
}

interface RawPayload {
  login: string;
  name: string | null;
  avatarUrl: string;
  location: string | null;
  createdAt: string;
  followers: number;
  publicRepos: number;
  repos: RawRepo[];
  languageRepos: { language: string | null }[];
  recentCommits: number;
  recentPRs: number;
  recentReviews: number;
  recentIssues: number;
  recentRestricted: number;
  recentActiveDays: number;
  lifetimeContributions: number;
}

const fail = (type: ClientScoutError["type"], message: string): never => {
  throw { type, message } satisfies ClientScoutError;
};

async function gql<T>(query: string, login: string, token: string): Promise<{ user: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { login } }),
      signal: ctrl.signal,
    });
  } catch {
    return fail("network", "Couldn't reach GitHub — check your connection.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) return fail("token", "Token is invalid or expired.");
  if (res.status === 403 || res.status === 429)
    return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
  if (!res.ok) return fail("network", `GitHub returned an error (${res.status}).`);

  let body: { data?: { user: T | null }; errors?: { type?: string; message?: string }[] };
  try {
    body = await res.json();
  } catch {
    return fail("network", "GitHub returned a malformed response.");
  }
  if (body.errors?.some((e) => e.type === "RATE_LIMITED" || e.type === "RATE_LIMIT"))
    return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
  return { user: body.data?.user ?? null };
}

function profileQuery(): string {
  return `
    query Profile($login: String!) {
      user(login: $login) {
        login
        name
        avatarUrl(size: 480)
        location
        createdAt
        followers { totalCount }
        repositories(ownerAffiliations: [OWNER, ORGANIZATION_MEMBER], isFork: false, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
          totalCount
          nodes { nameWithOwner stargazerCount primaryLanguage { name } createdAt pushedAt }
        }
        recent: contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalIssueContributions
          restrictedContributionsCount
          commitContributionsByRepository(maxRepositories: 100) {
            contributions { totalCount }
            repository { nameWithOwner isFork isPrivate primaryLanguage { name } }
          }
          contributionCalendar { weeks { contributionDays { contributionCount } } }
        }
      }
    }`;
}

function lifetimeQuery(years: number[], currentYear: number, nowIso: string): string {
  const aliases = years
    .map((y) => {
      const to = y === currentYear ? nowIso : `${y}-12-31T23:59:59Z`;
      return `        y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") { totalCommitContributions totalIssueContributions totalPullRequestContributions totalPullRequestReviewContributions restrictedContributionsCount }`;
    })
    .join("\n");
  return `
    query Lifetime($login: String!) {
      user(login: $login) {
${aliases}
      }
    }`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchLifetime(
  login: string,
  token: string,
  createdYear: number,
  currentYear: number,
  nowIso: string,
): Promise<number> {
  const years: number[] = [];
  for (let y = Math.max(createdYear, GITHUB_EPOCH_YEAR); y <= currentYear; y++) years.push(y);

  const sums = await Promise.all(
    chunk(years, LIFETIME_BATCH).map(async (batch) => {
      try {
        const { user } = await gql<Record<string, YearContrib | null>>(
          lifetimeQuery(batch, currentYear, nowIso),
          login,
          token,
        );
        if (!user) return 0;
        return batch.reduce((s, y) => {
          const c = user[`y${y}`];
          return c
            ? s +
                c.totalCommitContributions +
                c.totalIssueContributions +
                c.totalPullRequestContributions +
                c.totalPullRequestReviewContributions +
                c.restrictedContributionsCount
            : s;
        }, 0);
      } catch {
        return 0;
      }
    }),
  );
  return sums.reduce((a, b) => a + b, 0);
}

function normalize(user: UserNode, lifetimeContributions: number): RawPayload {
  const repos: RawRepo[] = user.repositories.nodes.map((n) => ({
    stars: n.stargazerCount ?? 0,
    language: n.primaryLanguage?.name ?? null,
    createdAt: n.createdAt,
    pushedAt: n.pushedAt,
  }));

  const languageByRepo = new Map<string, string | null>();
  for (const n of user.repositories.nodes) {
    languageByRepo.set(n.nameWithOwner, n.primaryLanguage?.name ?? null);
  }
  for (const c of user.recent.commitContributionsByRepository ?? []) {
    const r = c.repository;
    if (r.isFork || r.isPrivate || !r.primaryLanguage) continue;
    if (c.contributions.totalCount < MIN_CONTRIBUTED_LANG_COMMITS) continue;
    if (languageByRepo.has(r.nameWithOwner)) continue;
    languageByRepo.set(r.nameWithOwner, r.primaryLanguage.name);
  }
  const languageRepos = [...languageByRepo.values()].map((language) => ({ language }));

  const recentActiveDays = user.recent.contributionCalendar.weeks.reduce(
    (days, w) => days + w.contributionDays.filter((d) => d.contributionCount > 0).length,
    0,
  );

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.location,
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    repos,
    languageRepos,
    recentCommits: user.recent.totalCommitContributions,
    recentPRs: user.recent.totalPullRequestContributions,
    recentReviews: user.recent.totalPullRequestReviewContributions,
    recentIssues: user.recent.totalIssueContributions,
    recentRestricted: user.recent.restrictedContributionsCount,
    recentActiveDays,
    lifetimeContributions,
  };
}

/**
 * Scouts a GitHub profile client-side using the visitor's own token. The token
 * is sent ONLY to api.github.com — never to GitFut's servers. Returns the same
 * Card type as the server pipeline.
 *
 * Throws ClientScoutError on failure.
 */
export async function clientScout(username: string, token: string): Promise<Card> {
  const login = username.trim().replace(/^@/, "");
  if (!VALID.test(login)) return fail("invalid", "That doesn't look like a GitHub username.");
  if (!token.trim()) return fail("token", "Please provide a GitHub token.");

  const now = new Date();
  const { user } = await gql<UserNode>(profileQuery(), login, token);
  if (!user) return fail("notfound", "No GitHub user by that name.");

  const createdYear = new Date(user.createdAt).getUTCFullYear();
  const lifetimeContributions = await fetchLifetime(
    login,
    token,
    createdYear,
    now.getUTCFullYear(),
    now.toISOString(),
  );

  const payload = normalize(user, lifetimeContributions);
  return buildCard(signalsFromPayload(payload));
}
