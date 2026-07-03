import "server-only";

// Server-only GitHub client, on the GraphQL API (api.github.com/graphql).
// GraphQL is authenticated-only, so GITHUB_TOKEN is REQUIRED — which also puts
// us on the ~5,000 req/hr tier instead of the ~60/hr unauthenticated REST tier.
// Crucially, the GraphQL `contributionsCollection` is the ONLY GitHub API that
// returns real commit / PR / review / issue / calendar data — the numbers the
// scoring layer used to estimate.
//
// Lifetime contributions need one contributionsCollection window per calendar
// year (each window must span ≤1yr). GitHub's resolver times out (~10s) if too
// many windows share a request, so we fetch the profile in one fast query, then
// the years in small parallel batches with a retry — and tolerate a dropped
// batch (the figure is only used log-scaled, so a missing year barely moves it).

export type GithubErrorType = "invalid" | "notfound" | "ratelimit" | "network" | "config";

export interface GithubError {
  type: GithubErrorType;
  message: string;
}

export interface RawRepo {
  stars: number;
  language: string | null;
  createdAt: string;
  pushedAt: string;
}

// Flat, normalized profile — all fields below are real GitHub data.
export interface RawPayload {
  login: string;
  name: string | null;
  avatarUrl: string;
  location: string | null;
  createdAt: string;
  followers: number;
  publicRepos: number;
  repos: RawRepo[]; // owned, non-fork, top 100 by stars
  recentCommits: number; // the "recent" fields cover the last 365 days
  recentPRs: number;
  recentReviews: number;
  recentIssues: number;
  recentRestricted: number; // last-year private contributions (count only)
  recentActiveDays: number;
  lifetimeContributions: number; // all years, all types, incl. private
}

const ENDPOINT = "https://api.github.com/graphql";
const REST_ENDPOINT = "https://api.github.com";
const REST_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "gitfut",
};
const VALID = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const GITHUB_EPOCH_YEAR = 2008; // GitHub launched Feb 2008; no account predates it.
const LIFETIME_BATCH = 4; // contribution windows per request — stays well under GitHub's timeout.

const fail = (type: GithubErrorType, message: string): never => {
  throw { type, message } satisfies GithubError;
};

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// --- GraphQL response shapes (only the fields we read) ---
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
    restrictedContributionsCount: number; // private contributions, when the user shows them
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

interface RestUser {
  login: string;
  name: string | null;
  avatar_url: string;
  location: string | null;
  created_at: string;
  followers: number;
  public_repos: number;
}

interface RestRepoItem {
  stargazers_count: number;
  language: string | null;
  created_at: string;
  pushed_at: string | null;
  fork: boolean;
}

// POSTs a query, retrying transient failures. Terminal failures (bad token,
// not found, rate limit) throw a GithubError; success returns the user node.
async function gql<T>(query: string, login: string, token: string, retries = 1): Promise<{ user: T | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { login } }),
      });
    } catch {
      if (attempt < retries) {
        await delay();
        continue;
      }
      return fail("network", "Couldn't reach GitHub — check your connection.");
    }

    if (res.status === 401) return fail("config", "GitHub token is invalid or expired.");
    if (res.status === 403 || res.status === 429) return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
    if (res.status >= 500) {
      if (attempt < retries) {
        await delay();
        continue;
      }
      return fail("network", `GitHub is unavailable (${res.status}).`);
    }
    if (!res.ok) return fail("network", `GitHub returned an error (${res.status}).`);

    let body: { data?: { user: T | null }; errors?: { type?: string; message?: string }[] };
    try {
      body = await res.json();
    } catch {
      if (attempt < retries) {
        await delay();
        continue;
      }
      return fail("network", "GitHub returned a malformed response.");
    }

    if (body.errors?.some((e) => e.type === "RATE_LIMITED")) {
      return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
    }
    if (body.errors?.length) {
      const message = body.errors.map((e) => e.message).filter(Boolean).join(" ");
      return fail("network", message || "GitHub GraphQL returned an error.");
    }
    return { user: body.data?.user ?? null };
  }
  return fail("network", "GitHub request failed."); // unreachable; satisfies the type checker
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
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
          totalCount
          nodes { stargazerCount primaryLanguage { name } createdAt pushedAt }
        }
        recent: contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalIssueContributions
          restrictedContributionsCount
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

// Sum of every year's contributions (commits + issues + PRs + reviews + private).
// Each batch is best-effort: a batch that fails after its retry contributes 0
// rather than failing the scout.
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

export async function fetchProfile(username: string, now = new Date()): Promise<RawPayload> {
  const login = username.trim().replace(/^@/, "");
  if (!VALID.test(login)) return fail("invalid", "That doesn't look like a GitHub username.");

  const token = process.env.GITHUB_TOKEN;
  if (!token) return fail("config", "Server is missing a GitHub token.");

  let user: UserNode | null = null;
  let graphQlError: GithubError | null = null;
  try {
    ({ user } = await gql<UserNode>(profileQuery(), login, token));
  } catch (e) {
    graphQlError = e as GithubError;
  }

  if (!user) {
    if (graphQlError?.type === "ratelimit" || graphQlError?.type === "config") {
      throw graphQlError;
    }
    return fetchPublicProfile(login);
  }

  const createdYear = new Date(user.createdAt).getUTCFullYear();
  const lifetimeContributions = await fetchLifetime(login, token, createdYear, now.getUTCFullYear(), now.toISOString());

  return normalize(user, lifetimeContributions);
}

async function restJson<T>(path: string, fallbackType: GithubErrorType = "network"): Promise<T> {
  const res = await fetch(`${REST_ENDPOINT}${path}`, { headers: REST_HEADERS });
  if (res.status === 404) return fail("notfound", "No GitHub user by that name.");
  if (res.status === 403 || res.status === 429) return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
  if (!res.ok) return fail(fallbackType, `GitHub returned an error (${res.status}).`);
  return (await res.json()) as T;
}

async function fetchPublicProfile(login: string): Promise<RawPayload> {
  const user = await restJson<RestUser>(`/users/${encodeURIComponent(login)}`);
  const publicRepos = await restJson<RestRepoItem[]>(
    `/users/${encodeURIComponent(user.login)}/repos?type=owner&sort=pushed&per_page=100`,
  );
  const repos = publicRepos
    .filter((r) => !r.fork)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .map((r) => ({
      stars: r.stargazers_count ?? 0,
      language: r.language ?? null,
      createdAt: r.created_at,
      pushedAt: r.pushed_at ?? r.created_at,
    }));

  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    location: user.location,
    createdAt: user.created_at,
    followers: user.followers,
    publicRepos: user.public_repos,
    repos,
    recentCommits: 0,
    recentPRs: 0,
    recentReviews: 0,
    recentIssues: 0,
    recentRestricted: 0,
    recentActiveDays: 0,
    lifetimeContributions: 0,
  };
}

function normalize(user: UserNode, lifetimeContributions: number): RawPayload {
  const repos: RawRepo[] = user.repositories.nodes.map((n) => ({
    stars: n.stargazerCount ?? 0,
    language: n.primaryLanguage?.name ?? null,
    createdAt: n.createdAt,
    pushedAt: n.pushedAt,
  }));

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
    recentCommits: user.recent.totalCommitContributions,
    recentPRs: user.recent.totalPullRequestContributions,
    recentReviews: user.recent.totalPullRequestReviewContributions,
    recentIssues: user.recent.totalIssueContributions,
    recentRestricted: user.recent.restrictedContributionsCount,
    recentActiveDays,
    lifetimeContributions,
  };
}
