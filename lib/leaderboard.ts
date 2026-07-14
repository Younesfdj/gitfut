import "server-only";
import { redis } from "./redis";
import type { Card } from "./scoring/types";

// Global, all-time leaderboard of every card gitfut has built, ranked by OVR.
// A Redis sorted set (score = overall, member = login) gives O(log N) ranked
// writes and a cheap top-N read; a companion hash carries the small display
// snapshot (name/avatar/country/position/finish) so a leaderboard read never
// has to re-fetch or re-score anyone. Both best-effort, mirroring
// lib/analytics + lib/redis: a missing REDIS_URL, a miss, or an outage just
// means an empty/stale leaderboard — it never throws and never blocks a scout.

const ZSET_KEY = "gitfut:leaderboard:overall";
const META_KEY = "gitfut:leaderboard:meta";

export interface LeaderboardEntry {
  rank: number;
  login: string;
  name: string;
  avatarUrl: string;
  country: string;
  position: Card["position"];
  finish: Card["finish"];
  overall: number;
}

type Meta = Pick<LeaderboardEntry, "login" | "name" | "avatarUrl" | "country" | "position" | "finish">;

// Record (or refresh) a card's leaderboard entry. Called once per fresh build
// (lib/scout's buildFresh) — re-scouting the same login within its cache TTL
// doesn't re-write; re-scouting after the TTL expires just overwrites the same
// member's score + meta, so nobody can appear twice.
export async function recordLeaderboardEntry(card: Card): Promise<void> {
  if (!redis) return;
  const login = card.login.toLowerCase();
  const meta: Meta = {
    login: card.login,
    name: card.name,
    avatarUrl: card.avatarUrl,
    country: card.country,
    position: card.position,
    finish: card.finish,
  };
  try {
    await Promise.all([
      redis.zadd(ZSET_KEY, card.overall, login),
      redis.hset(META_KEY, login, JSON.stringify(meta)),
    ]);
  } catch (e) {
    console.error("[leaderboard] record failed:", (e as Error).message);
  }
}

// Top N by OVR, highest first. Returns [] when Redis is off or empty rather
// than throwing, so the page/route can render a "no scouts yet" state.
export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  if (!redis) return [];
  try {
    const ranked = await redis.zrevrange(ZSET_KEY, 0, limit - 1, "WITHSCORES");
    if (ranked.length === 0) return [];

    const logins: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i < ranked.length; i += 2) {
      logins.push(ranked[i]);
      scores.push(Number(ranked[i + 1]));
    }

    // HMGET preserves the same login order, so meta[i] always matches logins[i].
    const rawMeta = await redis.hmget(META_KEY, ...logins);

    return logins.map((login, i) => {
      const parsed: Meta | null = rawMeta[i] ? (JSON.parse(rawMeta[i] as string) as Meta) : null;
      return {
        rank: i + 1,
        login,
        overall: scores[i],
        name: parsed?.name ?? login,
        avatarUrl: parsed?.avatarUrl ?? "",
        country: parsed?.country ?? "",
        position: parsed?.position ?? "CM",
        finish: parsed?.finish ?? "bronze",
      };
    });
  } catch (e) {
    console.error("[leaderboard] read failed:", (e as Error).message);
    return [];
  }
}

// A single scout's rank + OVR — for a "you're #N globally" callout on their
// own card. Null when they've never been scouted or Redis is unavailable.
export async function getLeaderboardRank(
  username: string,
): Promise<{ rank: number; overall: number } | null> {
  if (!redis) return null;
  const login = username.trim().replace(/^@/, "").toLowerCase();
  try {
    const [rank, score] = await Promise.all([redis.zrevrank(ZSET_KEY, login), redis.zscore(ZSET_KEY, login)]);
    if (rank == null || score == null) return null;
    return { rank: rank + 1, overall: Number(score) };
  } catch (e) {
    console.error("[leaderboard] rank lookup failed:", (e as Error).message);
    return null;
  }
}