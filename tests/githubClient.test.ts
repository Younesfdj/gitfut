import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// client.ts is server-only; stub it so the real module can load under vitest's node env.
vi.mock("server-only", () => ({}));

const { fetchProfile } = await import("@/lib/github/client");

// A resolver-timeout (or abuse-detection, or any other non-NOT_FOUND error)
// nulls the whole `user` node in the GraphQL response, same as a genuine
// "no such user" would. Regression coverage for that misclassification.

function mockResponse(body: unknown, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as Response;
}

describe("fetchProfile error classification", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a genuine missing user as notfound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          data: { user: null },
          errors: [{ type: "NOT_FOUND", message: "Could not resolve to a User with the login of 'ghost'." }],
        }),
      ),
    );

    await expect(fetchProfile("ghost")).rejects.toMatchObject({ type: "notfound" });
  });

  it("does not misreport a nulled user from an unrelated resolver error as notfound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          data: { user: null },
          errors: [{ type: "INTERNAL_SERVER_ERROR", message: "Something went wrong while executing your query." }],
        }),
      ),
    );

    await expect(fetchProfile("mrudelle")).rejects.toMatchObject({ type: "network" });
  });

  it("still treats RATE_LIMITED errors as ratelimit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          data: { user: null },
          errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }],
        }),
      ),
    );

    await expect(fetchProfile("mrudelle")).rejects.toMatchObject({ type: "ratelimit" });
  });
});
