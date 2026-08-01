import { ImageResponse } from "next/og";
import { scoutCard } from "@/lib/scout";
import { pickFlag } from "@/lib/flagPriority";
import { renderCardImage } from "@/lib/og/renderCard";
import { loadCardFonts } from "@/lib/og/card";
import { resolveEmbedKey, touchEmbedKey } from "@/lib/auth/embedKey";

export const runtime = "nodejs";

const W = 810;
const H = 1230;

// Embeddable card image: gitfut.com/<user>.png (via the next.config rewrite) -> here.
// Bare URL = public card. `?k=<opaque>` = private-aware when the GitFut embed key
// matches this username (never a GitHub PAT). Invalid/mismatched k falls back to
// public so broken READMEs still render.
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const url = new URL(req.url);
  const override = url.searchParams.get("country");
  const k = url.searchParams.get("k");

  let privateAware = false;
  let viewerLogin: string | undefined;
  let viewerToken: string | undefined;

  if (k) {
    const embed = await resolveEmbedKey(k);
    const loginNorm = username.trim().replace(/^@/, "").toLowerCase();
    if (embed && embed.login.toLowerCase() === loginNorm) {
      privateAware = true;
      viewerLogin = embed.login;
      viewerToken = embed.accessToken;
    }
  }

  try {
    const card = await scoutCard(
      username,
      privateAware ? { viewerLogin, viewerToken } : undefined,
    );
    if (privateAware && k) await touchEmbedKey(k);
    return await renderCardImage(
      { ...card, country: pickFlag(override, card.country) ?? "" },
      { privateAware },
    );
  } catch {
    return fallback(username);
  }
}

async function fallback(username: string) {
  const fonts = await loadCardFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#02001e",
          backgroundImage: "radial-gradient(60% 40% at 50% 32%, rgba(57,211,83,0.16), transparent 72%)",
          color: "#e6edf3",
          fontFamily: "DINPro",
          padding: 64,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", color: "#39d353", fontSize: 34, fontWeight: 700, letterSpacing: 6 }}>GITFUT</div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 24 }}>@{username}</div>
        <div style={{ display: "flex", fontSize: 30, color: "#a8b3bd", marginTop: 22 }}>scout this profile at</div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 32, color: "#39d353", fontWeight: 700 }}>gitfut.com</div>
      </div>
    ),
    { width: W, height: H, fonts, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
