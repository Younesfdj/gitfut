import "server-only";
import { cache } from "react";
import { redis } from "./redis";
import { buildCard } from "./scoring/engine";
import { fetchProfile, type GithubError } from "./github/client";
import { signalsFromPayload } from "./github/signals";
import { SAMPLE_CARDS } from "./github/samples";
import { getSession } from "./auth/session";
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
const CACHE_VERSION = "v2";
const CARD_TTL_SECONDS = 120 * 60; // 2h — GitHub stats move slowly; longer TTL = fewer refetches of hot profiles under load.
const AUTH_CARD_TTL_SECONDS = 60 * 60; // 1h — private-aware cards can move with private work

const normalizeLogin = (username: string) => username.trim().replace(/^@/, "").toLowerCase();
const keyFor = (login: string) => `gitfut:card:${CACHE_VERSION}:${login}`;
const keyForAuth = (login: string) => `gitfut:card:${CACHE_VERSION}:auth:${login}`;

export interface ScoutOptions {
  // When both match the scouted username, fetch with the viewer's OAuth token
  // so private/org contributions are included. Never set for embeds / OG.
  viewerLogin?: string;
  viewerToken?: string;
}

function isPrivateAware(login: string, options?: ScoutOptions): boolean {
  const viewer = options?.viewerLogin?.trim().replace(/^@/, "").toLowerCase();
  return !!(options?.viewerToken && viewer && viewer === login);
}

async function readCache(key: string): Promise<Card | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as Card) : null;
  } catch (e) {
    console.error("[scout] cache read failed:", (e as Error).message);
    return null;
  }
}

async function writeCache(key: string, card: Card, ttl: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(card), "EX", ttl);
  } catch (e) {
    console.error("[scout] cache write failed:", (e as Error).message);
  }
}

// Single-flight: concurrent scouts of the same login (+ public/auth mode)
// collapse onto one in-flight build. The Redis cache takes a beat to populate
// (a profile fetch is a handful of GitHub calls), so when a profile trends every
// hit in that fill window would otherwise be a full cache miss — one GitHub
// fetch *per concurrent viewer*. This map coalesces them into a single fetch
// whose result they all share.
//
// Keyed by cache key. Entries are deleted the moment the build settles
// (success or failure) so failures are never memoised — the next scout retries —
// and the map can't grow unbounded. Callers never mutate the returned Card (every
// surface spreads it: `{ ...card, country }`), so sharing one object is safe.
const inflight = new Map<string, Promise<Card>>();

async function buildFresh(
  username: string,
  login: string,
  cacheKey: string,
  privateAware: boolean,
  accessToken?: string,
): Promise<Card> {
  const payload = await fetchProfile(
    username,
    new Date(),
    accessToken ? { accessToken } : undefined,
  );
  const card: Card = {
    ...buildCard(signalsFromPayload(payload)),
    ...(privateAware ? { privateAware: true } : null),
  };
  await writeCache(
    cacheKey,
    card,
    privateAware ? AUTH_CARD_TTL_SECONDS : CARD_TTL_SECONDS,
  );
  return card;
}

// Username -> Card, Redis-cached. Throws the same GithubError as fetchProfile
// when the scout fails, so callers keep mapping it to a 404 page / error status /
// null OG exactly as before.
export async function scoutCard(username: string, options?: ScoutOptions): Promise<Card> {
  const login = normalizeLogin(username);
  const privateAware = isPrivateAware(login, options);
  const cacheKey = privateAware ? keyForAuth(login) : keyFor(login);

  // Tokenless demo: serve the in-memory sample cards by login so the home-fan
  // samples resolve (and the app stays explorable) without a GitHub token. They
  // already live in memory, so they bypass Redis entirely. Checks both env vars
  // so a pool-only deploy (GITHUB_TOKENS without GITHUB_TOKEN) scouts for real.
  // Private-aware self-scouts still need a live token (the viewer's).
  if (!privateAware && !process.env.GITHUB_TOKEN && !process.env.GITHUB_TOKENS) {
    const sample = SAMPLE_CARDS.find((c) => c.login.toLowerCase() === login);
    if (sample) return sample;
  }

  const cached = await readCache(cacheKey);
  if (cached) return cached;

  // Coalesce concurrent misses for this key onto one build (see `inflight`).
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const pending = buildFresh(
    username,
    login,
    cacheKey,
    privateAware,
    privateAware ? options?.viewerToken : undefined,
  ).finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, pending);
  return pending;
}

// Request-memoised card load that returns the scout error instead of throwing,
// so a route's generateMetadata + Page — and a Duel's two corners — share one
// scout per request and render the failure state themselves. The cross-request
// Redis cache lives in scoutCard above; this cache() only dedupes within a
// single request/render pass.
//
// mode "viewer": if the signed-in user matches the scouted login, build a
// private-aware card. Embeds / OG / duels should use "public" (default).
export const loadCard = cache(
  async (
    username: string,
    mode: "public" | "viewer" = "public",
  ): Promise<{ card: Card } | { error: GithubError }> => {
    try {
      let options: ScoutOptions | undefined;
      if (mode === "viewer") {
        const session = await getSession();
        if (session) {
          options = { viewerLogin: session.login, viewerToken: session.accessToken };
        }
      }
      return { card: await scoutCard(username, options) };
    } catch (e) {
      return { error: e as GithubError };
    }
  },
);
