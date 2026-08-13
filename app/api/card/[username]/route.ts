import { type GithubError } from "@/lib/github/client";
import { scoutCard } from "@/lib/scout";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
import { recordLeaderboardEntry } from "@/lib/leaderboard";
import { after } from "next/server";
import type { Card } from "@/lib/scoring/types";

// Resolve the card's flag by priority (override → GitHub). No IP/geo fallback —
// an unknown country shows no flag rather than the viewer's own.
function resolveCountry(card: Card, override: string | null): Card {
  return { ...card, country: pickFlag(override, card.country) ?? "" };
}

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const override = new URL(req.url).searchParams.get("country");
  // scoutCard handles the Redis cache and the tokenless sample fallback; here we
  // just resolve the visitor's flag and record the scout after the response.
  try {
    const card = await scoutCard(username);
    after(() => Promise.all([recordScout(), recordLeaderboardEntry(card)]));
    return Response.json(resolveCountry(card, override));
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
