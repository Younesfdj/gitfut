import "server-only";
import { redis } from "./redis";
import type { Card } from "./scoring/types";
import {
  type LeaderboardEntry,
  type MetaEntry,
  serializeMeta,
  parseMeta,
  assembleEntries,
  pageBounds,
  neighborBounds,
  sampleSeedEntries,
} from "./leaderboard-core";

// Sorted set = the ranking (score = overall); hash = per-login display fields.
// Versioned so a meta-shape change can invalidate the board by bumping v1.
const ZKEY = "gitfut:leaderboard:v1";
const METAKEY = "gitfut:leaderboard:meta:v1";
const DEFAULT_PAGE_SIZE = 25;

const norm = (u: string) => u.trim().replace(/^@/, "").toLowerCase();

// Add / update a card on the board. Best-effort: never throws, no-ops with no
// Redis. The ZSET member and hash field are the normalized login; the stored
// meta keeps the card's display-case login for the row link.
export async function recordLeaderboardEntry(card: Card): Promise<void> {
  if (!redis) return;
  const login = norm(card.login);
  try {
    await Promise.all([
      redis.zadd(ZKEY, card.overall, login),
      redis.hset(METAKEY, login, serializeMeta(card)),
    ]);
  } catch (e) {
    console.error("[leaderboard] record failed:", (e as Error).message);
  }
}

async function metasFor(logins: string[]): Promise<(MetaEntry | null)[]> {
  if (logins.length === 0 || !redis) return logins.map(() => null);
  const raw = await redis.hmget(METAKEY, ...logins);
  return raw.map(parseMeta);
}

// One page of the board, newest ranking first. Falls back to the sample seed
// when Redis is off, empty, or errors.
export async function getLeaderboardPage(
  page: number,
  size: number = DEFAULT_PAGE_SIZE,
): Promise<{ entries: LeaderboardEntry[]; total: number; page: number; totalPages: number }> {
  if (redis) {
    try {
      const total = await redis.zcard(ZKEY);
      if (total > 0) {
        const { start, stop, page: clamped, totalPages } = pageBounds(page, size, total);
        const members = await redis.zrevrange(ZKEY, start, stop);
        const metas = await metasFor(members);
        return { entries: assembleEntries(members, metas, start + 1), total, page: clamped, totalPages };
      }
    } catch (e) {
      console.error("[leaderboard] page read failed:", (e as Error).message);
    }
  }
  return seedPage(page, size);
}

function seedPage(page: number, size: number) {
  const all = sampleSeedEntries();
  const { start, stop, page: clamped, totalPages } = pageBounds(page, size, all.length);
  return { entries: all.slice(start, stop + 1), total: all.length, page: clamped, totalPages };
}

// A single login's rank + row, or null if they're on neither the board nor the seed.
export async function getRankFor(
  login: string,
): Promise<{ rank: number; total: number; entry: LeaderboardEntry } | null> {
  const key = norm(login);
  if (redis) {
    try {
      const [rankIdx, total] = await Promise.all([redis.zrevrank(ZKEY, key), redis.zcard(ZKEY)]);
      if (rankIdx != null) {
        const m = parseMeta(await redis.hget(METAKEY, key));
        if (m) return { rank: rankIdx + 1, total, entry: { rank: rankIdx + 1, ...m } };
      }
    } catch (e) {
      console.error("[leaderboard] rank read failed:", (e as Error).message);
    }
  }
  const seed = sampleSeedEntries();
  const idx = seed.findIndex((e) => e.login.toLowerCase() === key);
  return idx >= 0 ? { rank: idx + 1, total: seed.length, entry: seed[idx] } : null;
}

// The rows immediately above and below a login (±span). Empty when they're not ranked.
export async function getNeighbors(login: string, span: number): Promise<LeaderboardEntry[]> {
  const key = norm(login);
  if (redis) {
    try {
      const [rankIdx, total] = await Promise.all([redis.zrevrank(ZKEY, key), redis.zcard(ZKEY)]);
      if (rankIdx != null && total > 0) {
        const { start, stop } = neighborBounds(rankIdx, span, total);
        const members = await redis.zrevrange(ZKEY, start, stop);
        return assembleEntries(members, await metasFor(members), start + 1);
      }
    } catch (e) {
      console.error("[leaderboard] neighbors read failed:", (e as Error).message);
    }
  }
  const seed = sampleSeedEntries();
  const idx = seed.findIndex((e) => e.login.toLowerCase() === key);
  if (idx < 0) return [];
  const { start, stop } = neighborBounds(idx, span, seed.length);
  return seed.slice(start, stop + 1);
}
