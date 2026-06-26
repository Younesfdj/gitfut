import { fetchProfile, type GithubError } from "@/lib/github/client";
import { signalsFromPayload } from "@/lib/github/signals";
import { buildCard } from "@/lib/scoring/engine";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import { getViewerCountry } from "@/lib/ipgeo";
import { needsIpFallback, pickFlag } from "@/lib/flagPriority";
import type { Card } from "@/lib/scoring/types";

// Resolve the card's flag by priority (override → GitHub → viewer IP). The IP
// lookup only runs when it can change the result, so the common GitHub-resolved
// path stays network-free.
async function resolveCountry(card: Card, override: string | null, req: Request): Promise<Card> {
  const ip = needsIpFallback(override, card.country) ? await getViewerCountry(req) : null;
  return { ...card, country: pickFlag(override, card.country, ip) ?? "" };
}

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const override = new URL(req.url).searchParams.get("country");
  // Tokenless preview/demo fallback: serve the baked sample cards by login so
  // the app is explorable (and the home-fan samples are clickable) without a
  // GitHub token configured.
  if (!process.env.GITHUB_TOKEN) {
    const sample = SAMPLE_CARDS.find((c) => c.login.toLowerCase() === username.toLowerCase());
    if (sample) return Response.json(await resolveCountry(sample, override, req));
  }
  try {
    const card = buildCard(signalsFromPayload(await fetchProfile(username)));
    return Response.json(await resolveCountry(card, override, req));
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
