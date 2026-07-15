import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests pin the single-flight + read-through cache behaviour of scoutCard.
// fetchProfile is the expensive GitHub call we dedupe, so it's mocked and counted;
// signals + engine are pass-throughs here (scoring is covered by engine.test.ts).
vi.mock("server-only", () => ({}));

const fetchProfile = vi.fn();
vi.mock("@/lib/github/client", () => ({ fetchProfile: (u: string) => fetchProfile(u) }));
vi.mock("@/lib/github/signals", () => ({ signalsFromPayload: (p: unknown) => p }));
// The real buildCard only forwards known Signals-derived fields — it does NOT
// carry an incidental contributionDays prop through. Stripping it here (rather
// than a plain identity pass-through) is what makes the assertions below
// actually exercise buildFresh's explicit `contributionDays: payload.contributionDays`
// re-attachment, instead of it passing by accident via the mock.
vi.mock("@/lib/scoring/engine", () => ({
  buildCard: (s: { contributionDays?: unknown }) => {
    const rest = { ...s };
    delete rest.contributionDays;
    return rest;
  },
}));

// In-memory Redis stand-in so read-through caching is exercised without a server.
const store = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v);
    },
  },
}));

import { scoutCard } from "@/lib/scout";

// A promise whose settlement we control, to freeze a fetch mid-flight.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const payload = (login: string) => ({ login, name: login, contributionDays: [{ date: "2026-01-01", count: 3 }] });

beforeEach(() => {
  store.clear();
  fetchProfile.mockReset();
  vi.stubEnv("GITHUB_TOKEN", "test-token"); // skip the tokenless sample fallback
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("scoutCard single-flight", () => {
  it("collapses concurrent misses for the same login into one fetch", async () => {
    const d = deferred<ReturnType<typeof payload>>();
    fetchProfile.mockReturnValueOnce(d.promise);

    // Different casings normalise to the same login -> one in-flight build.
    const calls = Promise.all([scoutCard("Torvalds"), scoutCard("torvalds"), scoutCard("TORVALDS")]);
    await flush();
    expect(fetchProfile).toHaveBeenCalledTimes(1);

    const p = payload("torvalds");
    d.resolve(p);
    const [a, b, c] = await calls;
    expect(a).toEqual(p);
    expect(b).toBe(a); // all three share the one built object
    expect(c).toBe(a);
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("fetches separately for different logins", async () => {
    fetchProfile.mockImplementation(async (u: string) => payload(u));
    await Promise.all([scoutCard("alice"), scoutCard("bob")]);
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("does not memoise failures — the next scout retries", async () => {
    fetchProfile.mockRejectedValueOnce({ type: "ratelimit", message: "limited" });
    await expect(scoutCard("torvalds")).rejects.toMatchObject({ type: "ratelimit" });
    expect(fetchProfile).toHaveBeenCalledTimes(1);

    // in-flight entry cleared and nothing cached -> a retry hits GitHub again.
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await expect(scoutCard("torvalds")).resolves.toMatchObject({ login: "torvalds" });
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });

  it("serves a cached card without refetching", async () => {
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await scoutCard("torvalds"); // populates the cache
    await scoutCard("torvalds"); // served from cache
    await scoutCard("torvalds");
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("refetches once the in-flight build has settled (window closed)", async () => {
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await scoutCard("torvalds");
    // Simulate the cache expiring/evicting between scouts.
    store.clear();
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    await scoutCard("torvalds");
    expect(fetchProfile).toHaveBeenCalledTimes(2);
  });
});

describe("scoutCard contribution calendar", () => {
  it("carries contributionDays from the fetch onto the built card, even though buildCard itself drops it", async () => {
    fetchProfile.mockResolvedValueOnce(payload("torvalds"));
    const card = await scoutCard("torvalds");
    expect(card.contributionDays).toEqual(payload("torvalds").contributionDays);
  });
});
