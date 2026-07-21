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

// Runtime allow-lists for the enum fields, declared as Record<Union, true> so the
// compiler forces every Finish/Position variant to be listed here (add a new
// finish to the type and this stops compiling until it's added). isFinish /
// isPosition then narrow an unknown value against them.
const FINISH_VALUES: Record<Finish, true> = {
  bronze: true,
  silver: true,
  gold: true,
  totw: true,
  toty: true,
  icon: true,
  founder: true,
};
const POSITION_VALUES: Record<Position, true> = {
  ST: true,
  RW: true,
  CAM: true,
  CM: true,
  CDM: true,
  CB: true,
};
const has = (o: object, v: unknown): boolean => typeof v === "string" && Object.prototype.hasOwnProperty.call(o, v);
const isFinish = (v: unknown): v is Finish => has(FINISH_VALUES, v);
const isPosition = (v: unknown): v is Position => has(POSITION_VALUES, v);

// Full-shape guard: every MetaEntry field must be present and the right type, and
// finish/position must be real enum values. Downstream consumers (e.g. the row's
// RESULT_THEME[finish] lookup) assume a complete, valid record, so a partial or
// legacy blob must be rejected, not passed through.
function isMetaEntry(v: unknown): v is MetaEntry {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.login === "string" &&
    typeof m.name === "string" &&
    typeof m.avatarUrl === "string" &&
    typeof m.overall === "number" &&
    Number.isFinite(m.overall) &&
    isFinish(m.finish) &&
    typeof m.finishLabel === "string" &&
    isPosition(m.position) &&
    typeof m.country === "string" &&
    (m.topLanguage === null || typeof m.topLanguage === "string") &&
    (m.langSlug === null || typeof m.langSlug === "string")
  );
}

// Tolerant parse: any bad/missing/legacy/corrupt JSON yields null so the row is
// skipped rather than crashing the page (best-effort, mirrors lib/scout.ts
// readCache). Validates the FULL MetaEntry shape — a partially-populated blob like
// { login, overall } is rejected, since consumers assume a complete record.
export function parseMeta(json: string | null): MetaEntry | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  return isMetaEntry(raw) ? raw : null;
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
