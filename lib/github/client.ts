import "server-only";
import { tokenPool, pickToken, pickFailover, recordTokenHealth, benchToken, type PoolToken } from "./tokens";

// Server-only GitHub client, on the GraphQL API (api.github.com/graphql).
// GraphQL is authenticated-only, so a token is REQUIRED — which also puts
// us on the ~5,000 req/hr tier instead of the ~60/hr unauthenticated REST tier.
// Tokens come from the pool in ./tokens (GITHUB_TOKENS, or GITHUB_TOKEN as a
// pool of one): each scout is hash-sharded to one token, with a single failover
// retry if that token turns out to be rate-limited.
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
  repos: RawRepo[]; // owned + org-created, non-fork, top 100 by stars
  recentCommits: number; // the "recent" fields cover the last 365 days
  recentPRs: number;
  recentReviews: number;
  recentIssues: number;
  recentRestricted: number; // last-year private contributions (count only)
  recentActiveDays: number;
  lifetimeContributions: number; // all years, all types, incl. private
}

const ENDPOINT = "https://api.github.com/graphql";
// GitHub's username *charset*: alphanumerics + hyphens, 1–39 chars, at least one
// alphanumeric. Deliberately looser than GitHub's modern signup grammar (which
// forbids leading/trailing/double hyphens) so we still accept legacy accounts that
// predate it — e.g. "Gandalf-", a real 2014 account. GitHub is the arbiter of
// existence; this only screens out impossible input (spaces, symbols, over-length).
const VALID = /^(?=.*[a-z\d])[a-z\d-]{1,39}$/i;
const GITHUB_EPOCH_YEAR = 2008; // GitHub launched Feb 2008; no account predates it.
const ORG_REPO_BATCH = 8; // contribution windows per request — stays well under GitHub's timeout.
const LIFETIME_BATCH = 4; // contribution windows per request — stays well under GitHub's timeout.
// Abort a GitHub request that hangs at the socket level, instead of letting it
// hang the whole scout (and, under load, starve other requests). Kept BELOW
// Vercel's ~10s serverless function cap: at 8s we still get to return a clean
// error (or retry) before the platform kills the invocation with a 504.
const REQUEST_TIMEOUT_MS = 8_000;

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
  organizations: {
    nodes: {
      repositories: {
        nodes: {
          nameWithOwner: string;
          stargazerCount: number;
          primaryLanguage: { name: string } | null;
          createdAt: string;
          pushedAt: string;
        }[];
      };
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

interface OrgRepoNode {
    nameWithOwner: string;
    stargazerCount: number;
    primaryLanguage: { name: string; } | null;
    createdAt: string;
    pushedAt: string;
}

// POSTs a query, retrying transient failures. Terminal failures (bad token,
// not found, rate limit) throw a GithubError; success returns the user node.
// Every response's rate-limit headers feed the token-health record; a limited
// response additionally benches the token so failover skips it.
async function gql<T>(query: string, login: string, tok: PoolToken, retries = 1): Promise<{ user: T | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { login } }),
        signal: ctrl.signal,
      });
    } catch {
      // Includes the AbortError from a timeout — retried like any transient network failure.
      if (attempt < retries) {
        await delay();
        continue;
      }
      return fail("network", "Couldn't reach GitHub — check your connection.");
    } finally {
      clearTimeout(timer);
    }

    recordTokenHealth(tok.idx, res.headers); // fire-and-forget, never blocks

    if (res.status === 401) return fail("config", "GitHub token is invalid or expired.");
    if (res.status === 403 || res.status === 429) {
      benchToken(tok.idx, res.headers);
      return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
    }
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

    // GitHub sends the type as "RATE_LIMITED" (secondary) or "RATE_LIMIT" (primary,
    // with code "graphql_rate_limit"). Match all so an exhausted quota reports as a
    // rate limit rather than falling through to a misleading "no user found".
    if (body.errors?.some((e) => e.type === "RATE_LIMITED" || e.type === "RATE_LIMIT")) {
      benchToken(tok.idx, res.headers);
      return fail("ratelimit", "GitHub rate limit hit. Try again shortly.");
    }
    return { user: body.data?.user ?? null };
  }
  return fail("network", "GitHub request failed."); // unreachable; satisfies the type checker
}

// Like gql but returns the full data payload without assuming a `user` root.
// Used for queries that don't follow the `query($login) { user(...) { ... } }` shape.
async function gqlRaw<T>(query: string, tok: PoolToken, retries = 1): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: ctrl.signal,
      });
    } catch {
      if (attempt < retries) { await delay(); continue; }
      return null;
    } finally {
      clearTimeout(timer);
    }

    recordTokenHealth(tok.idx, res.headers);
    if (res.status === 401 || res.status === 403 || res.status === 429) return null;
    if (res.status >= 500) { if (attempt < retries) { await delay(); continue; } return null; }
    if (!res.ok) return null;

    try {
      const body: { data?: T; errors?: { type?: string }[] } = await res.json();
      if (body.errors?.some((e) => e.type === "RATE_LIMITED" || e.type === "RATE_LIMIT")) return null;
      return body.data ?? null;
    } catch {
      if (attempt < retries) { await delay(); continue; }
      return null;
    }
  }
  return null;
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
        organizations(first: 20) {
          nodes {
            repositories(isFork: false, first: 10, orderBy: { field: STARGAZERS, direction: DESC }) {
              nodes {
                nameWithOwner
                stargazerCount primaryLanguage { name } createdAt pushedAt
              }
            }
          }
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

function repositoryAuthorQuery(repos: OrgRepoNode[]): string {
  const authors = repos
    .map((r, i) => {
      const [owner, name] = r.nameWithOwner.split("/");
      const d = new Date(r.createdAt);
      d.setUTCDate(d.getUTCDate() + 1);
      d.setUTCHours(0, 0, 0, 0);
      return `        r${i}: repository(owner: "${owner}", name: "${name}") { defaultBranchRef { target { ... on Commit { history(first: 1, until: "${d.toISOString()}") { nodes { author { user { login } } } } } } } }`;
    })
    .join("\n");
  return `
    query {
${authors}
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

async function resolveOrgRepoCreators(
  repos: OrgRepoNode[],
  login: string,
  tok: PoolToken,
): Promise<Set<string>> {
  const created = new Set<string>();
  if (!repos.length) return created;

  await Promise.all(
    chunk(repos, ORG_REPO_BATCH).map(async (batch) => {
      try {
        const data = await gqlRaw<{
          [alias: string]: { defaultBranchRef: { target: { history: { nodes: { author: { user: { login: string } | null } }[] } } } | null } | null;
        }>(repositoryAuthorQuery(batch), tok);
        if (!data) return;
        batch.forEach((r, i) => {
          const author = data[`r${i}`]?.defaultBranchRef?.target?.history?.nodes[0]?.author?.user?.login;
          if (author === login) created.add(r.nameWithOwner);
        });
      } catch {
        // Best-effort: a failed batch just means those repos won't be credited.
      }
    }),
  );
  return created;
}

// Sum of every year's contributions (commits + issues + PRs + reviews + private).
// Each batch is best-effort: a batch that fails after its retry contributes 0
// rather than failing the scout.
async function fetchLifetime(
  login: string,
  tok: PoolToken,
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
          tok,
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

  const pool = tokenPool();
  if (!pool.length) return fail("config", "Server is missing a GitHub token.");

  // One token per scout (hash-sharded on the login), threaded through every
  // query below so a user's profile + lifetime batches never straddle tokens.
  let tok = pickToken(login, pool) as PoolToken;

  let user: UserNode | null;
  try {
    ({ user } = await gql<UserNode>(profileQuery(), login, tok));
  } catch (e) {
    // Only a rate limit is cured by another token (a timeout or 5xx would just
    // fail again) — retry once on the healthiest token, if the pool has one.
    if ((e as GithubError).type !== "ratelimit" || pool.length < 2) throw e;
    const fallback = await pickFailover(tok.idx, pool);
    if (!fallback) throw e; // every other token is benched too
    tok = fallback;
    ({ user } = await gql<UserNode>(profileQuery(), login, tok));
  }
  if (!user) return fail("notfound", "No GitHub user by that name.");

  const allOrgRepos = (user.organizations?.nodes ?? []).flatMap((org) => org.repositories.nodes);
  const [lifetimeContributions, orgCreated] = await Promise.all([
    fetchLifetime(login, tok, new Date(user.createdAt).getUTCFullYear(), now.getUTCFullYear(), now.toISOString()),
    resolveOrgRepoCreators(allOrgRepos, login, tok),
  ]);

  return normalize(user, lifetimeContributions, orgCreated);
}

function normalize(user: UserNode, lifetimeContributions: number, orgCreated: Set<string>): RawPayload {
  const ownedRepos: RawRepo[] = user.repositories.nodes.map((n) => ({
    stars: n.stargazerCount ?? 0,
    language: n.primaryLanguage?.name ?? null,
    createdAt: n.createdAt,
    pushedAt: n.pushedAt,
  }));

  const organizationRepos: RawRepo[] = user.organizations.nodes.flatMap((org) =>
    org.repositories.nodes
      .filter((r) => orgCreated.has(r.nameWithOwner))
      .map((n) => ({
        stars: n.stargazerCount ?? 0,
        language: n.primaryLanguage?.name ?? null,
        createdAt: n.createdAt,
        pushedAt: n.pushedAt,
      })),
  );

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
    repos: [...ownedRepos, ...organizationRepos],
    recentCommits: user.recent.totalCommitContributions,
    recentPRs: user.recent.totalPullRequestContributions,
    recentReviews: user.recent.totalPullRequestReviewContributions,
    recentIssues: user.recent.totalIssueContributions,
    recentRestricted: user.recent.restrictedContributionsCount,
    recentActiveDays,
    lifetimeContributions,
  };
}
