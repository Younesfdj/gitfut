import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({ redis: null }));

import { fetchProfile } from "@/lib/github/client";
import { hashLogin } from "@/lib/github/tokens";

const POOL = ["expired-token", "healthy-token"];
const LOGIN = "someuser";
const NOW = new Date("2026-07-03T12:00:00Z");

const USER = {
  login: LOGIN,
  name: null,
  avatarUrl: "https://example.com/a.png",
  location: null,
  createdAt: "2026-01-01T00:00:00Z",
  followers: { totalCount: 1 },
  repositories: { totalCount: 0, nodes: [] },
  recent: {
    totalCommitContributions: 1,
    totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalIssueContributions: 0,
    restrictedContributionsCount: 0,
    commitContributionsByRepository: [],
    contributionCalendar: { weeks: [] },
  },
};

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  vi.stubEnv("GITHUB_TOKENS", POOL.join(","));
  vi.stubEnv("GITHUB_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("fails over when the hash-assigned GitHub token is invalid", async () => {
  const primary = POOL[hashLogin(LOGIN) % POOL.length];
  const fallback = POOL.find((token) => token !== primary)!;
  const calls: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const token = String(
        (init?.headers as Record<string, string>).Authorization,
      ).replace("Bearer ", "");
      const body = String(init?.body);
      calls.push(token);

      if (token === primary) {
        return new Response(JSON.stringify({ message: "Bad credentials" }), {
          status: 401,
        });
      }

      return body.includes("query Profile")
        ? ok({ data: { user: USER } })
        : ok({ data: { user: {} } });
    }),
  );

  const payload = await fetchProfile(LOGIN, NOW);

  expect(payload.login).toBe(LOGIN);
  expect(calls).toEqual([primary, fallback, fallback]);
});
