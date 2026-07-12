import type { Card, Finish, Position } from "@/lib/scoring/types";
import { SAMPLE_CARDS } from "@/lib/github/samples";

// A single rendered leaderboard row.
export interface LeaderboardEntry {
  rank: number; // 1-based display rank
  login: string;
  name: string;
  avatarUrl: string;
  overall: number;
  finish: Finish;
  finishLabel: string;
  position: Position;
  country: string;
  topLanguage: string | null;
  langSlug: string | null;
}

// Everything a row needs except its rank — this is what we persist per login in
// the meta hash (rank is derived at read time from the sorted set).
export type MetaEntry = Omit<LeaderboardEntry, "rank">;

// Card -> the compact display record. Single source of truth so serializeMeta
// (write path) and sampleSeedEntries (fallback) never drift apart.
export function cardToMeta(card: Card): MetaEntry {
  return {
    login: card.login,
    name: card.name,
    avatarUrl: card.avatarUrl,
    overall: card.overall,
    finish: card.finish,
    finishLabel: card.finishLabel,
    position: card.position,
    country: card.country,
    topLanguage: card.topLanguage ?? null,
    langSlug: card.languageLogo?.slug ?? null,
  };
}

export const serializeMeta = (card: Card): string => JSON.stringify(cardToMeta(card));

// Tolerant parse: any bad/missing/legacy JSON yields null so the row is skipped
// rather than crashing the page (best-effort, mirrors lib/scout.ts readCache).
export function parseMeta(json: string | null): MetaEntry | null {
  if (!json) return null;
  try {
    const m = JSON.parse(json) as MetaEntry;
    if (!m || typeof m.login !== "string" || typeof m.overall !== "number") return null;
    return m;
  } catch {
    return null;
  }
}

// Zip parallel members + metas into ranked entries. rank is tied to the member's
// POSITION (startRank + i), so a missing-meta skip leaves later ranks correct.
export function assembleEntries(
  members: string[],
  metas: (MetaEntry | null)[],
  startRank: number,
): LeaderboardEntry[] {
  const out: LeaderboardEntry[] = [];
  for (let i = 0; i < members.length; i++) {
    const m = metas[i];
    if (!m) continue;
    out.push({ rank: startRank + i, ...m });
  }
  return out;
}

// Inclusive ZREVRANGE indices for a page, with the page clamped into range.
export function pageBounds(
  page: number,
  size: number,
  total: number,
): { start: number; stop: number; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const clamped = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (clamped - 1) * size;
  return { start, stop: start + size - 1, page: clamped, totalPages };
}

// Inclusive ZREVRANGE indices for a ±span window around a 0-based rank index,
// clamped to the board.
export function neighborBounds(
  rankIndex: number,
  span: number,
  total: number,
): { start: number; stop: number } {
  return {
    start: Math.max(0, rankIndex - span),
    stop: Math.min(total - 1, rankIndex + span),
  };
}

// Redis-off / empty-board fallback: rank the baked sample cards by overall desc
// (login as a stable tiebreak) so the page always renders something real.
export function sampleSeedEntries(): LeaderboardEntry[] {
  return [...SAMPLE_CARDS]
    .sort((a, b) => b.overall - a.overall || a.login.localeCompare(b.login))
    .map((c, i) => ({ rank: i + 1, ...cardToMeta(c) }));
}
