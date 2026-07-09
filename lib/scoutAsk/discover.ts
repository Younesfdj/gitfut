import "server-only";
import { pickToken, pickFailover, recordTokenHealth, type PoolToken } from "@/lib/github/tokens";
import { scoutCard } from "@/lib/scout";
import { githubLocationQualifier, locationTermsForCountry } from "@/lib/scoutAsk/locationQueries";
import { runRecipe } from "@/lib/scoutAsk/runRecipe";
import { renderRecipe } from "@/lib/scoutAsk/render";
import type { Recipe } from "@/lib/scoutAsk/types";
import type { Card } from "@/lib/scoring/types";

const SEARCH_PER_PAGE = 30;
const MAX_SCOUT = 30;
const SCOUT_CONCURRENCY = 3;

interface SearchUser {
  login: string;
}

async function searchUsers(
  q: string,
  tok: PoolToken,
): Promise<{ logins: string[]; limited: boolean; status: number; error?: string }> {
  const url = new URL("https://api.github.com/search/users");
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", String(SEARCH_PER_PAGE));
  // Default best-match ranking - sorting by followers buries mid-follower locals
  // (e.g. darula-hpp is ~#21 in location:Gaborone by followers).

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tok.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "gitfut-scout-ask",
    },
    signal: AbortSignal.timeout(8_000),
  });
  recordTokenHealth(tok.idx, res.headers);

  if (res.status === 403 || res.status === 429) {
    return { logins: [], limited: true, status: res.status };
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string; errors?: { message?: string }[] };
      detail = body.errors?.[0]?.message ?? body.message ?? detail;
    } catch {
      /* ignore */
    }
    return { logins: [], limited: false, status: res.status, error: detail };
  }
  const data = (await res.json()) as { items?: SearchUser[] };
  const logins = (data.items ?? []).map((u) => u.login).filter(Boolean);
  return { logins, limited: false, status: res.status };
}

/**
 * Discover logins by searching each location term separately.
 * GitHub forbids `location:A OR location:B` (422) - that was why Botswana Ask
 * returned zero search hits and never scouted real Gaborone profiles.
 */
async function discoverLogins(
  countryCode: string,
): Promise<{ logins: string[]; source: "search" | "none"; error?: string }> {
  const poolTok = pickToken(`ask:${countryCode}`);
  if (!poolTok) {
    return {
      logins: [],
      source: "none",
      error: "No GITHUB_TOKEN - cannot search GitHub.",
    };
  }

  const terms = locationTermsForCountry(countryCode);
  if (terms.length === 0) {
    return { logins: [], source: "none", error: `No location terms for ${countryCode}.` };
  }

  let tok: PoolToken = poolTok;
  const seen = new Set<string>();
  const merged: string[] = [];
  const errors: string[] = [];

  for (const term of terms) {
    const q = githubLocationQualifier(term);
    let result = await searchUsers(q, tok);

    if (result.limited) {
      const failover = await pickFailover(tok.idx);
      if (failover) {
        tok = failover;
        result = await searchUsers(q, tok);
      }
    }

    if (result.error) {
      errors.push(`${q}: ${result.error}`);
      continue;
    }
    if (result.limited) {
      errors.push(`${q}: rate limited`);
      continue;
    }

    for (const login of result.logins) {
      const key = login.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(login);
    }
  }

  if (merged.length === 0) {
    return {
      logins: [],
      source: "none",
      error: errors[0] ?? "GitHub location search returned no users.",
    };
  }

  return { logins: merged, source: "search" };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx]!;
      const r = await fn(item);
      if (r != null) out.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

export interface DiscoverResult {
  cards: Card[];
  source: "search" | "none";
  attempted: number;
  message?: string;
}

/**
 * Discover GitHub users for a country, scout them into Cards, then apply the
 * (already variable-substituted) recipe. Strict filters - no position fallback.
 */
export async function discoverAndRank(opts: {
  countryCode: string;
  recipe: Recipe;
  limit?: number;
}): Promise<DiscoverResult> {
  const { countryCode, recipe } = opts;
  const { logins, source, error } = await discoverLogins(countryCode);
  const slice = logins.slice(0, MAX_SCOUT);

  if (slice.length === 0) {
    return {
      cards: [],
      source: "none",
      attempted: 0,
      message: error ?? "No GitHub profiles found for that country.",
    };
  }

  const scouted = await mapPool(slice, SCOUT_CONCURRENCY, async (login) => {
    try {
      return await scoutCard(login);
    } catch {
      return null;
    }
  });

  // Location search already scoped to this country - fill blank flags so a
  // missing geo alias (e.g. Gaborone before it was mapped) doesn't drop locals.
  const tagged = scouted.map((c) =>
    c.country ? c : { ...c, country: countryCode.toLowerCase() },
  );

  const ranked = runRecipe(tagged, recipe);
  const limit = opts.limit ?? recipe.limit ?? 15;
  return {
    cards: ranked.slice(0, limit),
    source,
    attempted: slice.length,
    message:
      ranked.length === 0
        ? `Scouted ${slice.length} profile${slice.length === 1 ? "" : "s"} from GitHub; none matched this role/filter yet.`
        : undefined,
  };
}

/** Render recipe vars then discover - used by the Ask API. */
export async function discoverForAsk(opts: {
  countryCode: string;
  recipe: Recipe;
  vars: Record<string, string>;
}): Promise<DiscoverResult> {
  const recipe = renderRecipe(opts.recipe, opts.vars);
  return discoverAndRank({ countryCode: opts.countryCode, recipe });
}
