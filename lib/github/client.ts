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
//
// GitHub also rejects contributionsCollection outright (RESOURCE_LIMITS_EXCEEDED)
// when the window holds too many contribution events — measured mid-2026 at
// roughly 2k events per REQUEST, regardless of which fields are selected, and
// regardless of aliasing (two windows in one request pool their cost). Only
// hyperactive profiles trip it, but for them the one-shot profile query dies —
// so fetchProfile falls back to rebuilding the same payload from date-windowed
// slices, each small enough to fit the budget (see fetchProfileWindowed).

export type GithubErrorType =
  | "invalid"
  | "notfound"
  | "resource"
  | "ratelimit"
  | "network"
  | "config";

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

// A repo reduced to just its primary language — the unit the language-diversity
// signal counts. The scored list is the UNION of a user's owned repos and the
// public repos they've recently committed to (deduped by repo, built in
// normalize), so a developer whose work lives in orgs they don't *own* still gets
// a real language profile instead of a "0 languages" card.
export interface RawRepoLanguage {
  language: string | null;
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
  repos: RawRepo[]; // owned, non-fork, top 100 by stars (drives the star signals)
  languageRepos: RawRepoLanguage[]; // owned ∪ recently-contributed public repos, deduped — the language signal
  recentCommits: number; // the "recent" fields cover the last 365 days
  recentPRs: number;
  recentReviews: number;
  recentIssues: number;
  recentRestricted: number; // last-year private contributions (count only)
  recentActiveDays: number;
  lifetimeContributions: number; // all years, all types, incl. private
  // GitHub's "private contributions" account setting zeroes out
  // contributionsCollection entirely for every viewer but the owner — recent AND
  // every lifetime year — even when the account has real, public, recent commits.
  // No API field says so directly, and the all-zero signature alone is
  // ambiguous: a genuinely new/inactive account produces identical zeros. What
  // tells them apart is repos: contributionsCollection is the only thing the
  // privacy setting touches, so an owned public repo pushed within the last
  // year is real activity that survives it — see hasRecentRepoActivity below.
  hiddenActivity: boolean;
}

const ENDPOINT = "https://api.github.com/graphql";
// GitHub's username *charset*: alphanumerics + hyphens, 1–39 chars, at least one
// alphanumeric. Deliberately looser than GitHub's modern signup grammar (which
// forbids leading/trailing/double hyphens) so we still accept legacy accounts that
// predate it — e.g. "Gandalf-", a real 2014 account. GitHub is the arbiter of
// existence; this only screens out impossible input (spaces, symbols, over-length).
const VALID = /^(?=.*[a-z\d])[a-z\d-]{1,39}$/i;
const GITHUB_EPOCH_YEAR = 2008; // GitHub launched Feb 2008; no account predates it.
const LIFETIME_BATCH = 4; // contribution windows per request — stays well under GitHub's timeout.
// A repo only feeds the language signal once the user has really worked in it —
// this many commits in the last year — so a single drive-by typo fix to a large
// polyglot repo can't inflate their language diversity.
const MIN_CONTRIBUTED_LANG_COMMITS = 3;
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
    restrictedContributionsCount: number; // private contributions, when the user shows them
    // Public repos the user committed to in the last year, with each repo's
    // primary language — the source for counting languages beyond owned repos.
    commitContributionsByRepository: {
      contributions: { totalCount: number };
      repository: {
        nameWithOwner: string;
        isFork: boolean;
        isPrivate: boolean;
        primaryLanguage: { name: string } | null;
      };
    }[];
    contributionCalendar: {
      weeks: { contributionDays: { contributionCount: number }[] }[];
    };
  };
}

interface YearContrib {
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  restrictedContributionsCount: number;
}

// POSTs a query, retrying transient failures. Terminal failures (bad token,
// not found, rate limit) throw a GithubError; success returns the user node.
// Every response's rate-limit headers feed the token-health record; a limited
// response additionally benches the token so failover skips it.
async function gql<T>(
  query: string,
  login: string,
  tok: PoolToken,
  retries = 1,
): Promise<{ user: T | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok.token}`,
          "Content-Type": "application/json",
        },
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
    // A GraphQL error with data.user null is NOT "no such user" unless GitHub
    // says so (NOT_FOUND). Anything else was collapsing real errors — resource
    // limits above all — into a false "notfound" (issue #79).
    if (body.errors?.length && !body.data?.user) {
      if (body.errors.every((e) => e.type === "NOT_FOUND"))
        return { user: null };
      if (body.errors.some((e) => e.type === "RESOURCE_LIMITS_EXCEEDED"))
        return fail(
          "resource",
          "This profile's contribution history is too heavy for one query.",
        );
      return fail(
        "network",
        body.errors[0]?.message ?? "GitHub returned a GraphQL error.",
      );
    }
    // Field-level errors alongside a usable user node are a partial success —
    // keep the data.
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

type RecentNode = UserNode["recent"];
type BasicsNode = Omit<UserNode, "recent">;

// The last 365 days, same span the default contributionsCollection covers.
const RECENT_YEAR_MS = 365 * 86_400_000;
// How many times a failing window may halve. 2 splits from the half-year
// starting windows = ~46-day slices; a profile still over budget at that width
// (~16k+ events/yr, bot territory) degrades that slice to zeros, best-effort —
// the same philosophy fetchLifetime already applies to dropped batches.
const RECENT_WINDOW_SPLITS = 2;

// profileQuery() minus contributionsCollection — everything that stays cheap
// for hyperactive profiles (repositories cost is bounded by first: 100).
function basicsQuery(): string {
  return `
    query Basics($login: String!) {
      user(login: $login) {
        login
        name
        avatarUrl(size: 480)
        location
        createdAt
        followers { totalCount }
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
          totalCount
          nodes { nameWithOwner stargazerCount primaryLanguage { name } createdAt pushedAt }
        }
      }
    }`;
}

// One date-bounded slice of the recent-contributions block, same fields the
// one-shot query selects. from/to are inlined (gql only posts $login).
function recentWindowQuery(fromIso: string, toIso: string): string {
  return `
    query RecentWindow($login: String!) {
      user(login: $login) {
        recent: contributionsCollection(from: "${fromIso}", to: "${toIso}") {
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

function emptyRecent(): RecentNode {
  return {
    totalCommitContributions: 0,
    totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalIssueContributions: 0,
    restrictedContributionsCount: 0,
    commitContributionsByRepository: [],
    contributionCalendar: { weeks: [] },
  };
}

// Disjoint windows sum cleanly: totals add, per-repo commit counts merge by
// repo (so normalize's ≥3-commit language threshold sees the year's real
// total), calendars concatenate — a boundary day appears in both windows'
// calendars but with its count in exactly one, so active-day counting stays
// correct.
function combineRecent(parts: RecentNode[]): RecentNode {
  const out = emptyRecent();
  const byRepo = new Map<
    string,
    RecentNode["commitContributionsByRepository"][number]
  >();
  for (const p of parts) {
    out.totalCommitContributions += p.totalCommitContributions;
    out.totalPullRequestContributions += p.totalPullRequestContributions;
    out.totalPullRequestReviewContributions +=
      p.totalPullRequestReviewContributions;
    out.totalIssueContributions += p.totalIssueContributions;
    out.restrictedContributionsCount += p.restrictedContributionsCount;
    out.contributionCalendar.weeks.push(...p.contributionCalendar.weeks);
    for (const c of p.commitContributionsByRepository ?? []) {
      const seen = byRepo.get(c.repository.nameWithOwner);
      if (seen) seen.contributions.totalCount += c.contributions.totalCount;
      else
        byRepo.set(c.repository.nameWithOwner, {
          contributions: { totalCount: c.contributions.totalCount },
          repository: c.repository,
        });
    }
  }
  out.commitContributionsByRepository = [...byRepo.values()];
  return out;
}

// One window of recent contributions; on a resource rejection, halve and
// recurse (both halves in parallel) until the budget fits or splits run out.
async function fetchRecentWindow(
  login: string,
  tok: PoolToken,
  from: Date,
  to: Date,
  splitsLeft: number,
): Promise<RecentNode> {
  try {
    const { user } = await gql<{ recent: RecentNode }>(
      recentWindowQuery(from.toISOString(), to.toISOString()),
      login,
      tok,
    );
    return user?.recent ?? emptyRecent();
  } catch (e) {
    if ((e as GithubError).type !== "resource") throw e;
    if (splitsLeft === 0) return emptyRecent(); // over budget at the floor — zeros beat no card
    const mid = new Date((from.getTime() + to.getTime()) / 2);
    const halves = await Promise.all([
      fetchRecentWindow(login, tok, from, mid, splitsLeft - 1),
      fetchRecentWindow(
        login,
        tok,
        new Date(mid.getTime() + 1),
        to,
        splitsLeft - 1,
      ),
    ]);
    return combineRecent(halves);
  }
}

// Resource-limit fallback: the profile basics in one cheap query, plus the
// last year's contributions rebuilt from date-windowed slices. Two half-year
// windows suffice for the profiles seen in the wild (~2.3k events/yr); the
// split ladder in fetchRecentWindow absorbs heavier ones. Total cost for a
// typical affected profile: 3 requests, one round-trip deep.
async function fetchProfileWindowed(
  login: string,
  tok: PoolToken,
  now: Date,
): Promise<UserNode | null> {
  const { user } = await gql<BasicsNode>(basicsQuery(), login, tok);
  if (!user) return null;
  const from = new Date(now.getTime() - RECENT_YEAR_MS);
  const mid = new Date(now.getTime() - RECENT_YEAR_MS / 2);
  const halves = await Promise.all([
    fetchRecentWindow(login, tok, from, mid, RECENT_WINDOW_SPLITS),
    fetchRecentWindow(
      login,
      tok,
      new Date(mid.getTime() + 1),
      now,
      RECENT_WINDOW_SPLITS,
    ),
  ]);
  return { ...user, recent: combineRecent(halves) };
}

function lifetimeQuery(
  years: number[],
  currentYear: number,
  nowIso: string,
): string {
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

const sumContrib = (c: YearContrib) =>
  c.totalCommitContributions +
  c.totalIssueContributions +
  c.totalPullRequestContributions +
  c.totalPullRequestReviewContributions +
  c.restrictedContributionsCount;

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

  const yearsTotal = async (batch: number[]): Promise<number> => {
    const { user } = await gql<Record<string, YearContrib | null>>(
      lifetimeQuery(batch, currentYear, nowIso),
      login,
      tok,
    );
    if (!user) return 0;
    return batch.reduce((s, y) => {
      const c = user[`y${y}`];
      return c ? s + sumContrib(c) : s;
    }, 0);
  };

  const sums = await Promise.all(
    chunk(years, LIFETIME_BATCH).map(async (batch) => {
      try {
        return await yearsTotal(batch);
      } catch {
        // Aliased years pool their resource cost, so one hyperactive year sinks
        // its whole batch — retry each year alone (own request, own budget) and
        // let only the truly over-budget years degrade to 0.
        const singles = await Promise.all(
          batch.map((y) => yearsTotal([y]).catch(() => 0)),
        );
        return singles.reduce((a, b) => a + b, 0);
      }
    }),
  );
  return sums.reduce((a, b) => a + b, 0);
}

export async function fetchProfile(
  username: string,
  now = new Date(),
): Promise<RawPayload> {
  const login = username.trim().replace(/^@/, "");
  if (!VALID.test(login))
    return fail("invalid", "That doesn't look like a GitHub username.");

  const pool = tokenPool();
  if (!pool.length) return fail("config", "Server is missing a GitHub token.");

  // One token per scout (hash-sharded on the login), threaded through every
  // query below so a user's profile + lifetime batches never straddle tokens.
  let tok = pickToken(login, pool) as PoolToken;

  // The one-shot profile query, degrading to the windowed rebuild when GitHub's
  // resource limits reject it for a hyperactive profile.
  const fetchUser = async (t: PoolToken): Promise<UserNode | null> => {
    try {
      const { user } = await gql<UserNode>(profileQuery(), login, t);
      return user;
    } catch (e) {
      if ((e as GithubError).type !== "resource") throw e;
      return fetchProfileWindowed(login, t, now);
    }
  };

  let user: UserNode | null;
  try {
    user = await fetchUser(tok);
  } catch (e) {
    // Only a rate limit is cured by another token (a timeout or 5xx would just
    // fail again) — retry once on the healthiest token, if the pool has one.
    if ((e as GithubError).type !== "ratelimit" || pool.length < 2) throw e;
    const fallback = await pickFailover(tok.idx, pool);
    if (!fallback) throw e; // every other token is benched too
    tok = fallback;
    user = await fetchUser(tok);
  }
  if (!user) return fail("notfound", "No GitHub user by that name.");

  const createdYear = new Date(user.createdAt).getUTCFullYear();
  const lifetimeContributions = await fetchLifetime(
    login,
    tok,
    createdYear,
    now.getUTCFullYear(),
    now.toISOString(),
  );

  return normalize(user, lifetimeContributions, now);
}

function normalize(user: UserNode, lifetimeContributions: number, now: Date): RawPayload {
  const repos: RawRepo[] = user.repositories.nodes.map((n) => ({
    stars: n.stargazerCount ?? 0,
    language: n.primaryLanguage?.name ?? null,
    createdAt: n.createdAt,
    pushedAt: n.pushedAt,
  }));

  // Language diversity is scored over the UNION of the repos a user *owns* and the
  // public repos they've recently *committed to*, deduped by repo. Owning is only
  // one way to work in a language — a professional whose real code lives in orgs
  // they don't own would otherwise score "0 languages". Seed with owned repos
  // (authoritative, language may be null), then fold in each qualifying contributed
  // repo not already counted: public, non-fork, with a real commit footprint and a
  // language GitHub could classify. Private repos stay a bare contribution count in
  // GitHub's API (no repo/language), so they can't be counted here either.
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
  const languageRepos: RawRepoLanguage[] = [...languageByRepo.values()].map((language) => ({ language }));

  const recentActiveDays = user.recent.contributionCalendar.weeks.reduce(
    (days, w) => days + w.contributionDays.filter((d) => d.contributionCount > 0).length,
    0,
  );

  // A repo push isn't part of contributionsCollection, so the privacy setting
  // can't touch it — an owned public repo pushed in the last year is real,
  // dated evidence of work that the all-zero contribution figures contradict.
  // A genuinely new/inactive account has no such repo to point to.
  const hasRecentRepoActivity = repos.some(
    (r) => now.getTime() - Date.parse(r.pushedAt) <= RECENT_YEAR_MS,
  );

  // Every contribution figure (recent AND lifetime) is zero — the signature a
  // "private activity" account leaves across every window, GitHub's usual grid
  // included — but only counts as *hidden* (vs. a real zero-contribution
  // account, which produces identical zeros) when there's also a recently
  // pushed public repo contradicting it.
  const hiddenActivity =
    user.recent.totalCommitContributions === 0 &&
    user.recent.totalPullRequestContributions === 0 &&
    user.recent.totalPullRequestReviewContributions === 0 &&
    user.recent.totalIssueContributions === 0 &&
    user.recent.restrictedContributionsCount === 0 &&
    recentActiveDays === 0 &&
    lifetimeContributions === 0 &&
    hasRecentRepoActivity;

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
    hiddenActivity,
  };
}
