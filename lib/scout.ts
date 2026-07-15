import "server-only";
import { cache } from "react";
import { redis } from "./redis";
import { buildCard } from "./scoring/engine";
import { fetchProfile, type GithubError } from "./github/client";
import { signalsFromPayload } from "./github/signals";
import { SAMPLE_CARDS } from "./github/samples";
import type { Card } from "./scoring/types";

// Read-through Redis cache for built cards — the single path every scout surface
// (the /<user> page, the JSON API, the OG image) uses to turn a username into a
// Card. A profile is fetched from GitHub + scored at most once per TTL; repeat
// views, link unfurls and README-embed regenerations are then served from Redis
// instead of each spending a handful of GitHub GraphQL calls. This is the app's
// highest-leverage perf + rate-limit safeguard.
//
// Best-effort throughout, mirroring lib/analytics + lib/redis: a missing
// REDIS_URL, a cache miss, an outage or a parse error all fall through to a live
// fetch — the cache only ever changes speed, never behaviour. Only successful
// builds are stored; scout errors (notfound / ratelimit / …) propagate unchanged
// and are never cached.

// Namespaced alongside gitfut:scouts:total. The version segment lets a deploy
// that changes buildCard's output shape or scoring invalidate every entry at
// once (bump it) instead of serving stale-shaped cards until their TTL lapses.
const CACHE_VERSION = "v2"; // v2: Card gained contributionDays
const CARD_TTL_SECONDS = 120 * 60; // 2h — GitHub stats move slowly; longer TTL = fewer refetches of hot profiles under load.

const normalizeLogin = (username: string) => username.trim().replace(/^@/, "").toLowerCase();
const keyFor = (login: string) => `gitfut:card:${CACHE_VERSION}:${login}`;

async function readCache(login: string): Promise<Card | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(keyFor(login));
    return raw ? (JSON.parse(raw) as Card) : null;
  } catch (e) {
    console.error("[scout] cache read failed:", (e as Error).message);
    return null;
  }
}

async function writeCache(login: string, card: Card): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(keyFor(login), JSON.stringify(card), "EX", CARD_TTL_SECONDS);
  } catch (e) {
    console.error("[scout] cache write failed:", (e as Error).message);
  }
}

// Single-flight: concurrent scouts of the same login collapse onto one in-flight
// build. The Redis cache takes a beat to populate (a profile fetch is a handful
// of GitHub calls), so when a profile trends every hit in that fill window would
// otherwise be a full cache miss — one GitHub fetch *per concurrent viewer*. This
// map coalesces them into a single fetch whose result they all share.
//
// Keyed by normalized login. Entries are deleted the moment the build settles
// (success or failure) so failures are never memoised — the next scout retries —
// and the map can't grow unbounded. Callers never mutate the returned Card (every
// surface spreads it: `{ ...card, country }`), so sharing one object is safe.
const inflight = new Map<string, Promise<Card>>();

async function buildFresh(username: string, login: string): Promise<Card> {
  const payload = await fetchProfile(username);
  const card: Card = { ...buildCard(signalsFromPayload(payload)), contributionDays: payload.contributionDays };
  await writeCache(login, card);
  return card;
}

// Username -> Card, Redis-cached. Throws the same GithubError as fetchProfile
// when the scout fails, so callers keep mapping it to a 404 page / error status /
// null OG exactly as before.
export async function scoutCard(username: string): Promise<Card> {
  const login = normalizeLogin(username);

  // Tokenless demo: serve the in-memory sample cards by login so the home-fan
  // samples resolve (and the app stays explorable) without a GitHub token. They
  // already live in memory, so they bypass Redis entirely. Checks both env vars
  // so a pool-only deploy (GITHUB_TOKENS without GITHUB_TOKEN) scouts for real.
  if (!process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKENS) {
    const sample = SAMPLE_CARDS.find((c) => c.login.toLowerCase() === login);
    if (sample) return sample;
  }

  const cached = await readCache(login);
  if (cached) return cached;

  // Coalesce concurrent misses for this login onto one build (see `inflight`).
  const existing = inflight.get(login);
  if (existing) return existing;

  const pending = buildFresh(username, login).finally(() => inflight.delete(login));
  inflight.set(login, pending);
  return pending;
}

// Request-memoised card load that returns the scout error instead of throwing,
// so a route's generateMetadata + Page — and a Duel's two corners — share one
// scout per request and render the failure state themselves. The cross-request
// Redis cache lives in scoutCard above; this cache() only dedupes within a
// single request/render pass.
export const loadCard = cache(
  async (username: string): Promise<{ card: Card } | { error: GithubError }> => {
    try {
      return { card: await scoutCard(username) };
    } catch (e) {
      return { error: e as GithubError };
    }
  },
);
