import type { Card } from "@/lib/scoring/types";
import type { AskResult, Recipe } from "./types";
import { upsertCards } from "./idb";

export interface LiveDiscoverResponse {
  cards: Card[];
  source: "search" | "none";
  attempted: number;
  message?: string;
  error?: string;
}

/**
 * Second Ask step: call the server to search GitHub + scout + rank,
 * then merge results into the local IndexedDB corpus.
 */
export async function fetchLiveDiscover(opts: {
  countryCode: string;
  recipe: Recipe;
  vars: Record<string, string>;
  onProgress?: (msg: string) => void;
}): Promise<LiveDiscoverResponse> {
  opts.onProgress?.("Searching GitHub…");
  const res = await fetch("/api/ask/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode: opts.countryCode,
      recipe: opts.recipe,
      vars: opts.vars,
    }),
  });
  const data = (await res.json()) as LiveDiscoverResponse;
  if (!res.ok) {
    throw new Error(data.error ?? "Couldn't scout that country.");
  }
  if (data.cards.length) {
    opts.onProgress?.(`Scouting ${data.attempted} profiles…`);
    await upsertCards(data.cards);
  }
  return data;
}

/** After template match, if we have a country var, run live discovery. */
export async function enrichAskWithLiveDiscovery(
  result: AskResult,
  onProgress?: (msg: string) => void,
): Promise<AskResult> {
  if (result.missing.length) return result;
  const countryCode = result.vars.country;
  if (!countryCode) return result;

  // Always live-fetch for country recipes so results aren't stuck on a stale local squad.
  const live = await fetchLiveDiscover({
    countryCode,
    recipe: result.template.recipe,
    vars: result.vars,
    onProgress,
  });

  return {
    ...result,
    cards: live.cards.length ? live.cards : result.cards,
    liveMessage: live.message,
    liveSource: live.source,
  };
}
