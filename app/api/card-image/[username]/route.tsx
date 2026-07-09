import { ImageResponse } from "next/og";
import { scoutCard } from "@/lib/scout";
import { pickFlag } from "@/lib/flagPriority";
import { renderCardImage } from "@/lib/og/renderCard";
import { loadCardFonts } from "@/lib/og/card";

export const runtime = "nodejs";

const W = 810;
const H = 1230;

// Embeddable card image: gitfut.com/<user>.png (via the next.config rewrite) -> here.
// The card is rendered on demand to match the in-app PlayerCard (lib/og/renderCard)
// and cached hard at the CDN, so there's no object store to keep in sync or pay for.
// A failed scout (no such user) or a render error falls back to a small branded hint.
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  // Let embeds pin a flag: gitfut.com/<user>.png?country=fr (the .png rewrite keeps
  // the query). A valid override wins, else the GitHub-derived flag — same priority
  // as the page and JSON API.
  const override = new URL(req.url).searchParams.get("country");
  try {
    const card = await scoutCard(username);
    return await renderCardImage({ ...card, country: pickFlag(override, card.country) ?? "" });
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
