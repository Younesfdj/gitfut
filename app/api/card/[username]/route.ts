import { type GithubError } from "@/lib/github/client";
import { scoutCard, type ScoutOptions } from "@/lib/scout";
import { getSession } from "@/lib/auth/session";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
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
  // Private-aware only when the signed-in viewer matches the scouted login.
  // Embeds / anonymous callers get the public card.
  const session = await getSession();
  const options: ScoutOptions | undefined = session
    ? { viewerLogin: session.login, viewerToken: session.accessToken }
    : undefined;
  try {
    const card = await scoutCard(username, options);
    after(() => recordScout());
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
