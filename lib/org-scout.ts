import "server-only";
import { cache } from "react";
import { redis } from "./redis";
import { fetchOrganization, fetchOrganizationMembers, type OrgInfo, type OrgMember } from "./github/client";
import { scoutCard } from "./scout";
import { buildBestXI, type SquadResult } from "./squad-builder";
import type { Card } from "./scoring/types";

// Organization cache: stores the full squad result to avoid re-scouting
// the entire org on every page load. Individual member cards are already
// cached by scoutCard's own Redis layer, so this only caches the
// org-level aggregation (member list + squad build).
const CACHE_VERSION = "v1";
const ORG_TTL_SECONDS = 30 * 60; // 30min — org membership changes less than stats

const keyFor = (login: string) => `gitfut:org:${CACHE_VERSION}:${login}`;

interface OrgCacheEntry {
  org: OrgInfo;
  members: OrgMember[];
  cards: Card[];
  squad: SquadResult;
}

async function readOrgCache(login: string): Promise<OrgCacheEntry | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(keyFor(login));
    return raw ? (JSON.parse(raw) as OrgCacheEntry) : null;
  } catch {
    return null;
  }
}

async function writeOrgCache(login: string, entry: OrgCacheEntry): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(keyFor(login), JSON.stringify(entry), "EX", ORG_TTL_SECONDS);
  } catch {}
}

// In-flight dedup for org scouts (same as scoutCard's single-flight pattern)
const inflight = new Map<string, Promise<OrgCacheEntry>>();

// Bounded concurrency: scout members in parallel batches to stay within
// GitHub API limits while still being fast.
// ponytail: batch of 10, 50ms delay — fast enough for orgs <50 members.
// For larger orgs, consider streaming results or pre-warming the card cache.
const BATCH_SIZE = 10;

async function scoutMembers(members: OrgMember[]): Promise<Card[]> {
  const cards: Card[] = [];
  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((m) => scoutCard(m.login)),
    );
    for (const r of results) {
      if (r.status === "fulfilled") cards.push(r.value);
    }
    if (i + BATCH_SIZE < members.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return cards;
}

async function buildOrg(login: string): Promise<OrgCacheEntry> {
  const org = await fetchOrganization(login);
  const members = await fetchOrganizationMembers(login);
  // Cap at 60 scouted members to keep response times reasonable.
  // ponytail: 60 is enough to fill a strong XI; beyond that, diminishing returns.
  const cards = await scoutMembers(members.slice(0, 60));
  const { best } = buildBestXI(cards);
  const entry = { org, members, cards, squad: best };
  await writeOrgCache(login, entry);
  return entry;
}

export interface OrgResult {
  org: OrgInfo;
  members: OrgMember[];
  cards: Card[];
  squad: SquadResult;
}

export async function scoutOrganization(login: string): Promise<OrgResult> {
  const norm = login.trim().replace(/^@/, "").toLowerCase();

  // Check org-level cache first
  const cached = await readOrgCache(norm);
  if (cached) return cached;

  // Coalesce concurrent misses
  const existing = inflight.get(norm);
  if (existing) return existing;

  const pending = buildOrg(norm).finally(() => inflight.delete(norm));
  inflight.set(norm, pending);
  return pending;
}

// Request-memoised version (same pattern as loadCard in lib/scout.ts)
export const loadOrg = cache(
  async (login: string): Promise<{ org: OrgResult } | { error: { type: string; message: string } }> => {
    try {
      return { org: await scoutOrganization(login) };
    } catch (e) {
      return { error: e as { type: string; message: string } };
    }
  },
);
