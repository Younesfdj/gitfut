import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Exercises the real fetchProfile against a scripted fetch: token pool sharding,
// rate-limit failover, and the request-timeout backstop. Fake tokens + in-memory
// Redis only — no real credentials, no network.
vi.mock("server-only", () => ({}));

const store = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v);
    },
  },
}));

import { fetchProfile } from "@/lib/github/client";
import { hashLogin } from "@/lib/github/tokens";

const POOL = ["tokA", "tokB", "tokC", "tokD"];
const NOW = new Date("2026-07-03T12:00:00Z");
const LOGIN = "someuser";
const yearsFrom = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);
const queryYears = (body: string) => [...body.matchAll(/y(\d{4}):/g)].map((match) => Number(match[1]));
const yearCollection = (contributions: number, active: boolean) => ({
  totalCommitContributions: contributions,
  totalIssueContributions: 0,
  totalPullRequestContributions: 0,
  totalPullRequestReviewContributions: 0,
  restrictedContributionsCount: 0,
  hasAnyContributions: active,
});
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const healthKey = (idx: number) => `gitfut:ghtoken:v1:${idx}`;
const nowSec = () => Math.floor(Date.now() / 1000);

// Minimal-but-complete profile node; createdAt 2023 -> one lifetime batch, so a
// successful scout is exactly 2 requests (profile + lifetime).
const USER = {
  login: LOGIN,
  name: null,
  avatarUrl: "https://example.com/a.png",
  location: null,
  createdAt: "2023-02-01T00:00:00Z",
  followers: { totalCount: 1 },
  repositories: { totalCount: 0, nodes: [] },
  recent: {
    totalCommitContributions: 1,
    totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalIssueContributions: 0,
    restrictedContributionsCount: 0,
    contributionCalendar: { weeks: [] },
  },
};

const okHeaders = { "x-ratelimit-remaining": "4999", "x-ratelimit-reset": String(nowSec() + 3600) };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: okHeaders });
const okFor = (reqBody: string) =>
  reqBody.includes("query Profile") ? ok({ data: { user: USER } }) : ok({ data: { user: {} } });

// Scripted fetch: routes each request by bearer token, recording (token, body)
// pairs so tests can assert exactly which token carried which query.
type Call = { token: string; body: string };
let calls: Call[] = [];
function scriptFetch(respond: (token: string, body: string) => Response) {
  const mock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const token = String((init?.headers as Record<string, string>).Authorization).replace("Bearer ", "");
    const body = String(init?.body);
    calls.push({ token, body });
    return respond(token, body);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

const shardToken = () => POOL[hashLogin(LOGIN) % POOL.length];
const rateLimited = () =>
  new Response(JSON.stringify({ message: "rate limited" }), {
    status: 403,
    headers: { "retry-after": "60", "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(nowSec() + 1200) },
  });

beforeEach(() => {
  calls = [];
  store.clear();
  vi.stubEnv("GITHUB_TOKENS", POOL.join(","));
  vi.stubEnv("GITHUB_TOKEN", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchProfile token pool", () => {
  it("shards a scout onto its hash-assigned token and threads it through every query", async () => {
    scriptFetch((_t, body) => okFor(body));
    const payload = await fetchProfile(LOGIN, NOW);

    expect(payload.login).toBe(LOGIN);
    expect(calls.length).toBe(2); // profile + one lifetime batch
    for (const c of calls) expect(c.token).toBe(shardToken()); // never straddles tokens

    await flush(); // health write is fire-and-forget
    const idx = POOL.indexOf(shardToken());
    expect(JSON.parse(store.get(healthKey(idx))!).remaining).toBe(4999);
  });

  it("fails over once to another token when the assigned one is rate-limited", async () => {
    const primary = shardToken();
    scriptFetch((token, body) => (token === primary ? rateLimited() : okFor(body)));

    const payload = await fetchProfile(LOGIN, NOW);
    expect(payload.login).toBe(LOGIN);

    // 1 limited profile attempt on the primary, then profile + lifetime on ONE
    // other token (empty health -> first non-primary candidate).
    const expectedFallback = POOL.find((t) => t !== primary)!;
    expect(calls.map((c) => c.token)).toEqual([primary, expectedFallback, expectedFallback]);

    await flush();
    const benched = JSON.parse(store.get(healthKey(POOL.indexOf(primary)))!);
    expect(benched.remaining).toBe(0); // the limited token got benched for next time
  });

  it("fails over on a GraphQL-level RATE_LIMIT error too (HTTP 200 body)", async () => {
    const primary = shardToken();
    scriptFetch((token, body) =>
      token === primary ? ok({ errors: [{ type: "RATE_LIMIT", message: "exceeded" }] }) : okFor(body),
    );

    const payload = await fetchProfile(LOGIN, NOW);
    expect(payload.login).toBe(LOGIN);
    expect(calls[0].token).toBe(primary);
    expect(calls[1].token).not.toBe(primary);
  });

  it("propagates the rate limit when every other token is benched", async () => {
    const reset = nowSec() + 1200;
    for (let i = 0; i < POOL.length; i++) {
      if (POOL[i] !== shardToken()) store.set(healthKey(i), JSON.stringify({ remaining: 0, reset }));
    }
    const mock = scriptFetch(() => rateLimited());

    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "ratelimit" });
    expect(mock).toHaveBeenCalledTimes(1); // no healthy fallback -> no second attempt
  });

  it("single-token pool (GITHUB_TOKEN back-compat): works, and a rate limit has no failover", async () => {
    vi.stubEnv("GITHUB_TOKENS", "");
    vi.stubEnv("GITHUB_TOKEN", "solo");

    scriptFetch((_t, body) => okFor(body));
    const payload = await fetchProfile(LOGIN, NOW);
    expect(payload.login).toBe(LOGIN);
    for (const c of calls) expect(c.token).toBe("solo");

    calls = [];
    const mock = scriptFetch(() => rateLimited());
    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "ratelimit" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does NOT fail over on non-ratelimit errors (another token wouldn't cure them)", async () => {
    const mock = scriptFetch(() => new Response("nope", { status: 404 }));
    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "network" });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("fails as config when no token env is set at all", async () => {
    vi.stubEnv("GITHUB_TOKENS", "");
    vi.stubEnv("GITHUB_TOKEN", "");
    const mock = scriptFetch((_t, body) => okFor(body));
    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "config" });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("fetchProfile username validation", () => {
  it("accepts legacy usernames with a trailing hyphen (real GitHub accounts)", async () => {
    scriptFetch((_t, body) => okFor(body));
    // "Gandalf-" is a real 2014 account; it must reach GitHub, not be rejected as invalid.
    await expect(fetchProfile("gandalf-", NOW)).resolves.toBeTruthy();
    expect(calls.length).toBeGreaterThan(0);
  });

  it("also accepts leading and double hyphens (other legacy edge cases)", async () => {
    scriptFetch((_t, body) => okFor(body));
    await expect(fetchProfile("-gandalf", NOW)).resolves.toBeTruthy();
    await expect(fetchProfile("gan--dalf", NOW)).resolves.toBeTruthy();
  });

  it("still rejects impossible input before any network call", async () => {
    const mock = scriptFetch((_t, body) => okFor(body));
    for (const bad of ["foo bar", "foo@bar", "", "-", "a".repeat(40)]) {
      await expect(fetchProfile(bad, NOW)).rejects.toMatchObject({ type: "invalid" });
    }
    expect(mock).not.toHaveBeenCalled();
  });
});

describe("fetchProfile request timeout", () => {
  it("aborts a hung request at 8s (under Vercel's ~10s cap) and fails as a network error", async () => {
    vi.useFakeTimers();
    // fetch that never resolves on its own, but rejects (like the real one) when
    // its AbortSignal fires — so only our timeout can end it.
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = fetchProfile(LOGIN);
    const assertion = expect(result).rejects.toMatchObject({ type: "network" });

    // First attempt aborts at the 8s timeout, one retry after the backoff delay,
    // then the second attempt aborts too -> terminal network failure.
    await vi.advanceTimersByTimeAsync(8_000);
    await vi.advanceTimersByTimeAsync(250);
    await vi.advanceTimersByTimeAsync(8_000);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("fetchProfile GraphQL error triage + resource-limit fallback", () => {
  // Basics = the USER node minus its contributions block, what basicsQuery returns.
  const BASICS = Object.fromEntries(Object.entries(USER).filter(([k]) => k !== "recent"));

  const resourceError = () =>
    ok({
      data: { user: null },
      errors: [{ type: "RESOURCE_LIMITS_EXCEEDED", message: "Resource limits for this query exceeded." }],
    });

  // One date-window's worth of contributions. "acme/hot" is below the 3-commit
  // language threshold in EACH window and only qualifies once windows merge.
  const windowRecent = () => ({
    totalCommitContributions: 10,
    totalPullRequestContributions: 20,
    totalPullRequestReviewContributions: 30,
    totalIssueContributions: 40,
    restrictedContributionsCount: 50,
    commitContributionsByRepository: [
      {
        contributions: { totalCount: 2 },
        repository: { nameWithOwner: "acme/hot", isFork: false, isPrivate: false, primaryLanguage: { name: "Go" } },
      },
    ],
    contributionCalendar: { weeks: [{ contributionDays: [{ contributionCount: 1 }, { contributionCount: 0 }] }] },
  });

  // Days spanned by a RecentWindow request (from/to are inlined in the query,
  // which arrives JSON-escaped inside the POST body).
  const windowDays = (body: string) => {
    const m = body.match(/contributionsCollection\(from: \\"(.*?)\\", to: \\"(.*?)\\"/);
    return m ? (Date.parse(m[2]) - Date.parse(m[1])) / 86_400_000 : 0;
  };

  it("keeps GitHub's real NOT_FOUND on the notfound path", async () => {
    scriptFetch((_t, body) =>
      body.includes("query Profile(")
        ? ok({
            data: { user: null },
            errors: [{ type: "NOT_FOUND", message: "Could not resolve to a User with the login of 'nope'." }],
          })
        : okFor(body),
    );
    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "notfound" });
  });

  it("surfaces other GraphQL errors as network failures, never as notfound", async () => {
    scriptFetch((_t, body) =>
      body.includes("query Profile(")
        ? ok({ data: { user: null }, errors: [{ type: "SOMETHING_ELSE", message: "field failed" }] })
        : okFor(body),
    );
    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "network", message: "field failed" });
  });

  it("keeps a usable user node when field-level errors ride along (partial success)", async () => {
    scriptFetch((_t, body) =>
      body.includes("query Profile(")
        ? ok({ data: { user: USER }, errors: [{ type: "FORBIDDEN", message: "SAML enforced." }] })
        : okFor(body),
    );
    await expect(fetchProfile(LOGIN, NOW)).resolves.toMatchObject({ login: LOGIN });
  });

  it("rebuilds a resource-limited profile from basics + two half-year windows", async () => {
    scriptFetch((_t, body) => {
      if (body.includes("query Profile(")) return resourceError();
      if (body.includes("query Basics(")) return ok({ data: { user: BASICS } });
      if (body.includes("query RecentWindow(")) return ok({ data: { user: { recent: windowRecent() } } });
      return ok({ data: { user: {} } }); // lifetime — contributes 0 here
    });

    const payload = await fetchProfile(LOGIN, NOW);
    const windowCalls = calls.filter((c) => c.body.includes("query RecentWindow(")).length;

    expect(windowCalls).toBe(2);
    expect(calls.filter((c) => c.body.includes("query Basics(")).length).toBe(1);
    // Disjoint windows sum: totals add, calendars concatenate.
    expect(payload).toMatchObject({
      login: LOGIN,
      recentCommits: 20,
      recentPRs: 40,
      recentReviews: 60,
      recentIssues: 80,
      recentRestricted: 100,
      recentActiveDays: 2,
    });
    // Per-repo commit counts merge BEFORE the ≥3 threshold: 2 + 2 commits to
    // acme/hot only qualifies as a language because the windows were combined.
    expect(payload.languageRepos).toContainEqual({ language: "Go" });
  });

  it("splits a window that is itself over budget and sums the quarters", async () => {
    scriptFetch((_t, body) => {
      if (body.includes("query Profile(")) return resourceError();
      if (body.includes("query Basics(")) return ok({ data: { user: BASICS } });
      if (body.includes("query RecentWindow(")) {
        // Half-year windows (>120d) still blow the budget; quarters pass.
        if (windowDays(body) > 120) return resourceError();
        return ok({ data: { user: { recent: windowRecent() } } });
      }
      return ok({ data: { user: {} } });
    });

    const payload = await fetchProfile(LOGIN, NOW);
    const windowCalls = calls.filter((c) => c.body.includes("query RecentWindow(")).length;

    expect(windowCalls).toBe(6); // 2 rejected halves + 4 quarters
    expect(payload.recentPRs).toBe(20 * 4);
    expect(payload.recentActiveDays).toBe(4);
  });

  it("degrades a still-over-budget floor window to zeros instead of failing the scout", async () => {
    scriptFetch((_t, body) => {
      if (body.includes("query Profile(")) return resourceError();
      if (body.includes("query Basics(")) return ok({ data: { user: BASICS } });
      if (body.includes("query RecentWindow(")) return resourceError(); // every window, every depth
      return ok({ data: { user: {} } });
    });

    const payload = await fetchProfile(LOGIN, NOW);
    // Split ladder exhausted: 2 halves + 4 quarters + 8 eighths, all rejected.
    expect(calls.filter((c) => c.body.includes("query RecentWindow(")).length).toBe(14);
    // The card still exists — profile basics intact, contributions zeroed.
    expect(payload).toMatchObject({ login: LOGIN, recentPRs: 0, recentActiveDays: 0 });
  });

  it("stays notfound when the basics query says the user is gone mid-fallback", async () => {
    scriptFetch((_t, body) => {
      if (body.includes("query Profile(")) return resourceError();
      if (body.includes("query Basics(")) return ok({ data: { user: null } });
      return okFor(body);
    });
    await expect(fetchProfile(LOGIN, NOW)).rejects.toMatchObject({ type: "notfound" });
  });

  it("retries a resource-limited lifetime batch year by year", async () => {
    const requestedYears = yearsFrom(new Date(USER.createdAt).getUTCFullYear(), NOW.getUTCFullYear());
    const YEAR = {
      totalCommitContributions: 5,
      totalIssueContributions: 1,
      totalPullRequestContributions: 2,
      totalPullRequestReviewContributions: 1,
      restrictedContributionsCount: 1,
      hasAnyContributions: true,
    };
    const contributionsPerYear = Object.values(YEAR).reduce<number>(
      (total, value) => total + (typeof value === "number" ? value : 0),
      0,
    );
    scriptFetch((_t, body) => {
      if (body.includes("query Profile(")) return ok({ data: { user: USER } });
      if (body.includes("query Lifetime(")) {
        // The 4-year aliased batch pools its cost and dies; single years pass.
        const aliases = (body.match(/y\d{4}:/g) ?? []).length;
        if (aliases > 1) return resourceError();
        return ok({ data: { user: { [`y${body.match(/y(\d{4}):/)![1]}`]: YEAR } } });
      }
      return okFor(body);
    });

    const payload = await fetchProfile(LOGIN, NOW);
    expect(calls.filter((c) => c.body.includes("query Lifetime(")).length).toBe(1 + requestedYears.length);
    expect(payload.lifetimeContributions).toBe(contributionsPerYear * requestedYears.length);
    expect(payload.activeYears).toBe(requestedYears.length);
  });
});

describe("fetchProfile lifetime contribution years", () => {
  const startYear = 2021;
  const accountYears = yearsFrom(startYear, NOW.getUTCFullYear());
  const contributionCount = (year: number) => year - startYear + 1;
  const ownedNode = (year: number) => ({
    nameWithOwner: `${LOGIN}/repo-${year}`,
    stargazerCount: 0,
    primaryLanguage: null,
    createdAt: `${year}-01-01T00:00:00Z`,
    pushedAt: `${year}-12-01T00:00:00Z`,
  });
  const userWithOwnedRepoYears = (ownedRepoYears: Set<number>) => ({
    ...USER,
    createdAt: `${startYear}-01-01T00:00:00Z`,
    repositories: {
      totalCount: ownedRepoYears.size,
      nodes: [...ownedRepoYears].map(ownedNode),
    },
  });
  const collectionsFor = (
    body: string,
    contributionYears: Set<number>,
    missingYears = new Set<number>(),
  ) =>
    Object.fromEntries(
      queryYears(body)
        .filter((year) => !missingYears.has(year))
        .map((year) => [
          `y${year}`,
          yearCollection(contributionYears.has(year) ? contributionCount(year) : 0, contributionYears.has(year)),
        ]),
    );
  const lifetimeResourceError = () =>
    ok({
      data: { user: null },
      errors: [{ type: "RESOURCE_LIMITS_EXCEEDED", message: "Resource limits for this query exceeded." }],
    });

  it("derives active years from annual activity rather than owned-repository dates", async () => {
    const contributionYears = new Set(accountYears);
    const ownedRepoYears = new Set([accountYears[0], ...accountYears.slice(-3)]);
    const user = userWithOwnedRepoYears(ownedRepoYears);

    scriptFetch((_token, body) => {
      if (body.includes("query Profile(")) return ok({ data: { user } });
      return ok({ data: { user: collectionsFor(body, contributionYears) } });
    });

    const result = await fetchProfile(LOGIN, NOW);
    const lifetimeCalls = calls.filter((call) => call.body.includes("query Lifetime("));

    expect(lifetimeCalls).toHaveLength(Math.ceil(accountYears.length / 4));
    expect(lifetimeCalls.every((call) => call.body.includes("hasAnyContributions"))).toBe(true);
    expect(result.activeYears).toBe(contributionYears.size);
    expect(result.activeYears).not.toBe(ownedRepoYears.size);
  });

  it("counts only non-contiguous years where GitHub reports activity", async () => {
    const contributionYears = new Set(accountYears.filter((_year, index) => index % 2 === 0));
    const user = userWithOwnedRepoYears(new Set(accountYears));

    scriptFetch((_token, body) =>
      body.includes("query Profile(")
        ? ok({ data: { user } })
        : ok({ data: { user: collectionsFor(body, contributionYears) } }),
    );

    const result = await fetchProfile(LOGIN, NOW);
    const expectedLifetime = [...contributionYears].reduce((total, year) => total + contributionCount(year), 0);

    expect(result.activeYears).toBe(contributionYears.size);
    expect(result.lifetimeContributions).toBe(expectedLifetime);
  });

  it("retains recovered years when a batch falls back to individual requests", async () => {
    const contributionYears = new Set(accountYears);
    const user = userWithOwnedRepoYears(new Set());

    scriptFetch((_token, body) => {
      if (body.includes("query Profile(")) return ok({ data: { user } });
      if (queryYears(body).length > 1) return lifetimeResourceError();
      return ok({ data: { user: collectionsFor(body, contributionYears) } });
    });

    const result = await fetchProfile(LOGIN, NOW);
    const expectedLifetime = [...contributionYears].reduce((total, year) => total + contributionCount(year), 0);

    expect(result.activeYears).toBe(contributionYears.size);
    expect(result.lifetimeContributions).toBe(expectedLifetime);
  });

  it("treats an individually unavailable year as zero and inactive", async () => {
    const contributionYears = new Set(accountYears);
    const unavailableYears = new Set([accountYears[Math.floor(accountYears.length / 2)]]);
    const user = userWithOwnedRepoYears(new Set());

    scriptFetch((_token, body) => {
      if (body.includes("query Profile(")) return ok({ data: { user } });
      const requestedYears = queryYears(body);
      if (requestedYears.length > 1 || unavailableYears.has(requestedYears[0])) return lifetimeResourceError();
      return ok({ data: { user: collectionsFor(body, contributionYears) } });
    });

    const result = await fetchProfile(LOGIN, NOW);
    const recoveredYears = accountYears.filter((year) => !unavailableYears.has(year));
    const expectedLifetime = recoveredYears.reduce((total, year) => total + contributionCount(year), 0);

    expect(result.activeYears).toBe(recoveredYears.length);
    expect(result.lifetimeContributions).toBe(expectedLifetime);
  });

  it("treats an omitted annual collection as zero and inactive", async () => {
    const contributionYears = new Set(accountYears);
    const missingYears = new Set([accountYears[Math.floor(accountYears.length / 2)]]);
    const user = userWithOwnedRepoYears(new Set());

    scriptFetch((_token, body) =>
      body.includes("query Profile(")
        ? ok({ data: { user } })
        : ok({ data: { user: collectionsFor(body, contributionYears, missingYears) } }),
    );

    const result = await fetchProfile(LOGIN, NOW);
    const returnedYears = accountYears.filter((year) => !missingYears.has(year));
    const expectedLifetime = returnedYears.reduce((total, year) => total + contributionCount(year), 0);

    expect(result.activeYears).toBe(returnedYears.length);
    expect(result.lifetimeContributions).toBe(expectedLifetime);
  });
});

describe("fetchProfile language diversity (owned ∪ contributed)", () => {
  // A profile whose OWNED public repos are thin (one TS repo + one empty repo),
  // but who commits to several repos they don't own — the org/team-dev shape that
  // used to score "0 languages".
  const ownedNode = (nameWithOwner: string, language: string | null) => ({
    nameWithOwner,
    stargazerCount: 0,
    primaryLanguage: language ? { name: language } : null,
    createdAt: "2022-01-01T00:00:00Z",
    pushedAt: "2024-01-01T00:00:00Z",
  });
  const contrib = (
    nameWithOwner: string,
    totalCount: number,
    language: string | null,
    opts: { isFork?: boolean; isPrivate?: boolean } = {},
  ) => ({
    contributions: { totalCount },
    repository: {
      nameWithOwner,
      isFork: opts.isFork ?? false,
      isPrivate: opts.isPrivate ?? false,
      primaryLanguage: language ? { name: language } : null,
    },
  });

  const USER_LANGS = {
    ...USER,
    repositories: {
      totalCount: 2,
      nodes: [ownedNode("someuser/own-ts", "TypeScript"), ownedNode("someuser/own-empty", null)],
    },
    recent: {
      ...USER.recent,
      commitContributionsByRepository: [
        contrib("acme/api", 10, "Go"), // qualifies -> counts
        contrib("acme/cli", 3, "Rust"), // exactly at the threshold -> counts
        contrib("acme/driveby", 2, "Elixir"), // below threshold -> excluded
        contrib("acme/forked", 50, "Java", { isFork: true }), // fork -> excluded
        contrib("acme/secret", 99, "Kotlin", { isPrivate: true }), // private -> excluded
        contrib("acme/docs", 8, null), // no classified language -> excluded
        contrib("someuser/own-ts", 20, "TypeScript"), // dup of an owned repo -> not double-counted
      ],
    },
  };

  const langsOf = (payload: Awaited<ReturnType<typeof fetchProfile>>) =>
    new Set(payload.languageRepos.map((r) => r.language).filter(Boolean));

  it("requests commit contributions by repository in the profile query", async () => {
    scriptFetch((_t, body) => (body.includes("query Profile") ? ok({ data: { user: USER_LANGS } }) : ok({ data: { user: {} } })));
    await fetchProfile(LOGIN, NOW);
    expect(calls[0].body).toContain("commitContributionsByRepository");
  });

  it("folds contributed public repos into the language set, deduped against owned repos", async () => {
    scriptFetch((_t, body) => (body.includes("query Profile") ? ok({ data: { user: USER_LANGS } }) : ok({ data: { user: {} } })));
    const payload = await fetchProfile(LOGIN, NOW);

    // TypeScript (owned) + Go + Rust (contributed). One entry per repo, deduped:
    // own-ts, own-empty(null), acme/api, acme/cli = 4 rows; 3 distinct languages.
    expect(payload.languageRepos).toHaveLength(4);
    expect(langsOf(payload)).toEqual(new Set(["TypeScript", "Go", "Rust"]));
  });

  it("excludes forks, private repos, drive-by (< 3 commits) and unclassified repos", async () => {
    scriptFetch((_t, body) => (body.includes("query Profile") ? ok({ data: { user: USER_LANGS } }) : ok({ data: { user: {} } })));
    const langs = langsOf(await fetchProfile(LOGIN, NOW));
    for (const excluded of ["Java", "Kotlin", "Elixir"]) expect(langs.has(excluded)).toBe(false);
  });

  it("still yields no languages when there are neither owned nor qualifying contributed repos", async () => {
    // The baseline USER: empty owned repos and no commit-by-repo contributions.
    scriptFetch((_t, body) => okFor(body));
    const payload = await fetchProfile(LOGIN, NOW);
    expect(payload.languageRepos).toEqual([]);
  });
});
