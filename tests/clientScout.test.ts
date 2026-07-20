import { afterEach, describe, expect, it, vi } from "vitest";

// The client scout reuses signalsFromPayload + buildCard (no server-only), so
// this tests the browser-side fetch + normalize + pipeline identity.

const USER = {
  login: "testuser",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.png",
  location: null,
  createdAt: "2023-02-01T00:00:00Z",
  followers: { totalCount: 5 },
  repositories: { totalCount: 1, nodes: [] },
  recent: {
    totalCommitContributions: 50,
    totalPullRequestContributions: 3,
    totalPullRequestReviewContributions: 1,
    totalIssueContributions: 2,
    restrictedContributionsCount: 10,
    commitContributionsByRepository: [],
    contributionCalendar: { weeks: [{ contributionDays: [{ contributionCount: 5 }] }] },
  },
};

const okHeaders = { "content-type": "application/json" };
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: okHeaders });
const okFor = (reqBody: string) =>
  reqBody.includes("query Profile")
    ? ok({ data: { user: USER } })
    : ok({ data: { user: {} } });

type Call = { auth: string; body: string };
let calls: Call[] = [];

function scriptFetch(respond: (body: string) => Response) {
  const mock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const auth = String((init?.headers as Record<string, string>).Authorization);
    const body = String(init?.body);
    calls.push({ auth, body });
    return respond(body);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  calls = [];
  vi.unstubAllGlobals();
});

describe("clientScout", () => {
  it("sends the token only in the Authorization header to api.github.com", async () => {
    scriptFetch((body) => okFor(body));
    const { clientScout } = await import("@/lib/private/clientScout");

    await clientScout("testuser", "ghp_secret123");

    // Every call must carry the token as a Bearer header
    for (const c of calls) {
      expect(c.auth).toBe("Bearer ghp_secret123");
    }
    // At least profile + one lifetime batch
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("returns a Card with the same shape as the server pipeline", async () => {
    scriptFetch((body) => okFor(body));
    const { clientScout } = await import("@/lib/private/clientScout");

    const card = await clientScout("testuser", "ghp_secret123");

    expect(card).toHaveProperty("login", "testuser");
    expect(card).toHaveProperty("overall");
    expect(card).toHaveProperty("stats");
    expect(card).toHaveProperty("position");
    expect(card).toHaveProperty("finish");
    expect(typeof card.overall).toBe("number");
  });

  it("rejects an invalid username before any network call", async () => {
    const mock = scriptFetch((body) => okFor(body));
    const { clientScout } = await import("@/lib/private/clientScout");

    await expect(clientScout("", "ghp_tok")).rejects.toMatchObject({ type: "invalid" });
    await expect(clientScout("foo bar", "ghp_tok")).rejects.toMatchObject({ type: "invalid" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("rejects an empty token before any network call", async () => {
    const mock = scriptFetch((body) => okFor(body));
    const { clientScout } = await import("@/lib/private/clientScout");

    await expect(clientScout("testuser", "")).rejects.toMatchObject({ type: "token" });
    await expect(clientScout("testuser", "  ")).rejects.toMatchObject({ type: "token" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("reports a token error on a 401 response", async () => {
    scriptFetch(() => new Response("nope", { status: 401 }));
    const { clientScout } = await import("@/lib/private/clientScout");

    await expect(clientScout("testuser", "bad_token")).rejects.toMatchObject({ type: "token" });
  });

  it("reports a rate limit on a 403 response", async () => {
    scriptFetch(() => new Response("limit", { status: 403 }));
    const { clientScout } = await import("@/lib/private/clientScout");

    await expect(clientScout("testuser", "ghp_tok")).rejects.toMatchObject({ type: "ratelimit" });
  });

  it("reports notfound when the user doesn't exist", async () => {
    scriptFetch(() => ok({ data: { user: null } }));
    const { clientScout } = await import("@/lib/private/clientScout");

    await expect(clientScout("noone", "ghp_tok")).rejects.toMatchObject({ type: "notfound" });
  });
});
