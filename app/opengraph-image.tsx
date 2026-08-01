import { ImageResponse } from "next/og";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import { loadCardAssets, cardTree } from "@/lib/og/renderCard";
import { groupAwards } from "@/lib/awards";
import { loadTrophyStills, trophyShelf } from "@/lib/og/trophies";

// Branded preview for the home page / bare gitfut.com links. Next wires this as
// the default og:image + twitter:image automatically (metadataBase is absolute).
export const runtime = "nodejs";
export const alt = "GitFut — your GitHub, rated out of 99";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A real card (Linus Torvalds, a baked sample) as the hero instead of a
// placeholder chip — same renderer as /<user>.png and the unfurls.
const CARD_W = 316; // -> ~480 tall, fits the 630 frame with margin

export default async function Image() {
  const card = SAMPLE_CARDS.find((c) => c.login === "torvalds") ?? SAMPLE_CARDS[0];
  const groups = groupAwards(card.awards);
  const [assets, stills] = await Promise.all([loadCardAssets(card, CARD_W), loadTrophyStills(groups)]);
  const shelf = groups.length ? trophyShelf({ groups, stills, tall: 84, header: null }) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#02001e",
          backgroundImage:
            "radial-gradient(900px 520px at 22% -12%, rgba(57,211,83,0.20), transparent 60%), radial-gradient(720px 520px at 105% 120%, rgba(212,175,55,0.14), transparent 60%)",
          color: "#e6edf3",
          fontFamily: "DINPro",
          padding: 72,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", paddingRight: 48 }}>
          <div style={{ display: "flex", color: "#39d353", fontSize: 24, fontWeight: 700, letterSpacing: 3 }}>
            GITHUB × WORLD CUP 26
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
            <div style={{ display: "flex", fontSize: 104, fontWeight: 800, lineHeight: 0.95 }}>GET</div>
            <div style={{ display: "flex", fontSize: 104, fontWeight: 800, lineHeight: 0.95 }}>
              <span>SCOUTED</span>
              <span style={{ color: "#39d353" }}>.</span>
            </div>
            <div style={{ display: "flex", fontSize: 33, color: "#a8b3bd", marginTop: 24, maxWidth: 600, lineHeight: 1.3 }}>
              Turn any GitHub profile into a World-Cup-style player card, rated out of 99. Now with trophies to earn.
            </div>
            {shelf && <div style={{ display: "flex", marginTop: 30 }}>{shelf}</div>}
          </div>
        </div>

        {/* the real card as the hero (Torvalds sample), same renderer as the embeds */}
        <div style={{ display: "flex" }}>{cardTree(card, assets, CARD_W)}</div>

        {/* url as a caption centered under the card, out of the trophy row's way */}
        <div style={{ position: "absolute", right: 72, bottom: 24, width: CARD_W, display: "flex", justifyContent: "center", fontSize: 26, color: "#6e7681" }}>
          gitfut.com
        </div>
      </div>
    ),
    { ...size, fonts: assets.fonts },
  );
}
