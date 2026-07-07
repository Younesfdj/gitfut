import { type GithubError } from "@/lib/github/client";
import { scoutCard } from "@/lib/scout";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
import { after } from "next/server";
import type { Card } from "@/lib/scoring/types";

// Resolve the card's flag and name by priority. No IP/geo fallback —
// an unknown country shows no flag rather than the viewer's own.
function resolveOverrides(card: Card, countryOverride: string | null, nameOverride: string | null): Card {
  const c = { ...card, country: pickFlag(countryOverride, card.country) ?? "" };
  if (nameOverride) {
    c.name = nameOverride;
  }
  return c;
}

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const url = new URL(req.url);
  const countryOverride = url.searchParams.get("country");
  const nameOverride = url.searchParams.get("name");
  // scoutCard handles the Redis cache and the tokenless sample fallback; here we
  // just resolve the visitor's flag and name overrides, and record the scout after the response.
  try {
    const card = await scoutCard(username);
    after(() => recordScout());
    return Response.json(resolveOverrides(card, countryOverride, nameOverride));
  } catch (e) {
    const err = e as GithubError;
    const status =
      err.type === "notfound"
        ? 404
        : err.type === "invalid"
          ? 400
          : err.type === "ratelimit"
            ? 429
            : err.type === "config"
              ? 500
              : 502;
    return Response.json({ error: err.message ?? "Failed to scout that profile." }, { status });
  }
}
