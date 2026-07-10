import { ImageResponse } from "next/og";
import { after } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { scoutCard } from "@/lib/scout";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
import { loadCardAssets, cardTree } from "@/lib/og/renderCard";
import { loadCardFonts } from "@/lib/og/card";
import { resolveResultTheme } from "@/components/finishTheme";
import { VS_PALETTE } from "@/components/VsBurst";
import { S_PATH, V_PATH, particlesAlong, sliverBetween } from "@/lib/vsBurst";
import type { Card } from "@/lib/scoring/types";

// The Fixture unfurl — the file-convention OG image for /<a>/vs/<b>. Next wires
// it into the page's og:image + twitter:image automatically, so page.tsx only
// sets the title/description/canonical.
//
// Composition mirrors the reference art: near-black stage, a full-canvas
// lightning strike behind a huge VS, and the two cards splayed OUTWARD with
// their inner corners tucked BEHIND the bolt so there's no dead-black band
// between card and centre. Angles were measured off the reference (outer edges
// lean ~6° out, bolt ~21° off vertical). The reference's 3D keystone can't be
// reproduced (Satori is strictly 2D), so the lean is a flat rotation. The card
// art PNGs are transparent outside the FUT silhouette, so the cards sit on the
// stage with no rectangular matte — same renderer as the /<user> card unfurl.

export const runtime = "nodejs";
export const alt =
  "GitFut Scout Duel — two player cards facing off across a lightning strike";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CARD_W = 373; // card ≈ 90% of poster height
const TILT = 6; // degrees each card's top tips AWAY from the centre line
const CARD_X = 150; // inner edges tuck behind the bolt; the right card mirrors it
const CARD_Y = 32;

// Full-canvas strike, top-right to bottom-left through the centre; the tips
// sit past the edges so no taper is visible on-canvas.
const BOLT_TOP: [number, number] = [740, -40];
const BOLT_BOT: [number, number] = [460, 670];
const EMBERS = particlesAlong(BOLT_BOT, BOLT_TOP, 34, 4, 4.2);

// VS letter block: V_PATH/S_PATH live on the 120×170 VsBurst grid, where the
// letters span x 16..105 / y 56..118. Scale that block up and centre it.
const VS_SCALE = 3.55; // letter block ≈ 220px tall (reference: ~1/3 of canvas)
const VS_TX = 600 - 60.5 * VS_SCALE;
const VS_TY = 315 - 87 * VS_SCALE;

const CACHE = {
  "Cache-Control":
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

async function loadBebas() {
  const data = await readFile(
    join(process.cwd(), "app", "fonts", "BebasNeue-Regular.ttf"),
  );
  return {
    name: "Bebas Neue",
    data,
    weight: 400 as const,
    style: "normal" as const,
  };
}

async function tryCard(username: string): Promise<Card | null> {
  try {
    const card = await scoutCard(username);
    return { ...card, country: pickFlag(null, card.country) ?? "" };
  } catch {
    return null;
  }
}

// The big explosive headline, shared by both variants.
function title(fontSize: number) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Bebas Neue",
        fontSize,
        color: "#f2fff4",
        letterSpacing: 6,
        textShadow: "0 0 26px rgba(57,211,83,.6), 0 2px 0 rgba(0,0,0,.6)",
      }}
    >
      SCOUT DUEL
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; opponent: string }>;
}) {
  const { username, opponent } = await params;
  const [a, b] = await Promise.all([tryCard(username), tryCard(opponent)]);

  // A side missing -> a text-only fixture card, still spoiler-free.
  if (!a || !b) {
    const [fonts, bebas] = await Promise.all([loadCardFonts(), loadBebas()]);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#05030e",
            backgroundImage:
              "radial-gradient(520px 300px at 50% -8%, rgba(235,255,240,0.12), transparent 60%), radial-gradient(760px 200px at 50% 103%, rgba(57,211,83,0.18), transparent 70%)",
            color: "#e6edf3",
            fontFamily: "DINPro",
            textAlign: "center",
            padding: 64,
          }}
        >
          {title(96)}
          <div
            style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 18 }}
          >
            @{username} vs @{opponent}
          </div>
          <div
            style={{ display: "flex", fontSize: 30, color: "#a8b3bd", marginTop: 18 }}
          >
            watch the duel at
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#39d353",
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            gitfut.com
          </div>
        </div>
      ),
      { ...size, fonts: [...fonts, bebas], headers: CACHE },
    );
  }

  after(() => Promise.all([recordScout(), recordScout()])); // count unfurls like the card OG does

  const aGlow = resolveResultTheme(a).glow;
  const bGlow = resolveResultTheme(b).glow;
  // Only aAssets.fonts is passed to ImageResponse; both cards use the same
  // static font set, so skip re-reading it for B (withFonts=false).
  const [aAssets, bAssets, bebas] = await Promise.all([
    loadCardAssets(a, CARD_W),
    loadCardAssets(b, CARD_W, false),
    loadBebas(),
  ]);

  const { fill, rim, glow, core } = VS_PALETTE;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#05030e",
          // the stage: overhead spotlight, green glow pooled at the floor, and
          // each card haloed in its own tier colour (the halos reach around the
          // cards so no dead-black frames them)
          backgroundImage: [
            "radial-gradient(520px 300px at 50% -8%, rgba(235,255,240,0.12), transparent 60%)",
            "radial-gradient(820px 210px at 50% 103%, rgba(57,211,83,0.22), transparent 70%)",
            "radial-gradient(260px 100px at 20% 101%, rgba(57,211,83,0.12), transparent 70%)",
            "radial-gradient(260px 100px at 80% 101%, rgba(57,211,83,0.1), transparent 70%)",
            `radial-gradient(440px 580px at 26% 48%, ${aGlow}, transparent 60%)`,
            `radial-gradient(440px 580px at 74% 48%, ${bGlow}, transparent 60%)`,
          ].join(", "),
          fontFamily: "DINPro",
          position: "relative",
        }}
      >
        {/* challenger — top tipping away from the centre line */}
        <div
          style={{
            position: "absolute",
            left: CARD_X,
            top: CARD_Y,
            display: "flex",
            transform: `rotate(-${TILT}deg)`,
          }}
        >
          {cardTree(a, aAssets, CARD_W)}
        </div>

        {/* opponent — mirrored lean */}
        <div
          style={{
            position: "absolute",
            left: size.width - CARD_X - CARD_W,
            top: CARD_Y,
            display: "flex",
            transform: `rotate(${TILT}deg)`,
          }}
        >
          {cardTree(b, bAssets, CARD_W)}
        </div>

        {/* the strike + VS, painted AFTER the cards (Satori has no z-index —
            document order is paint order), so the bolt crosses in front of the
            cards' inner corners exactly like the reference */}
        <svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <polygon points={sliverBetween(BOLT_BOT, BOLT_TOP, 24)} fill={glow} opacity={0.18} />
          <polygon points={sliverBetween(BOLT_BOT, BOLT_TOP, 13)} fill={glow} opacity={0.38} />
          <polygon points={sliverBetween(BOLT_BOT, BOLT_TOP, 6)} fill={rim} opacity={0.9} />
          <polygon points={sliverBetween(BOLT_BOT, BOLT_TOP, 2.5)} fill={core} opacity={0.97} />
          {EMBERS.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.bright ? core : glow}
              opacity={p.o}
            />
          ))}

          {/* letters over the bolt — the dark halo swallows the strike where it
              passes close, so it reads as behind the letter block */}
          <g transform={`translate(${VS_TX} ${VS_TY}) scale(${VS_SCALE})`}>
            <path
              d={V_PATH}
              fill="none"
              stroke="#02001e"
              strokeWidth={7}
              strokeLinejoin="round"
              opacity={0.85}
            />
            <path
              d={S_PATH}
              fill="none"
              stroke="#02001e"
              strokeWidth={7}
              strokeLinejoin="round"
              opacity={0.85}
            />
            <path d={V_PATH} fill={fill} stroke={rim} strokeWidth={2} strokeLinejoin="round" />
            <path d={S_PATH} fill={fill} stroke={rim} strokeWidth={2} strokeLinejoin="round" />
          </g>
        </svg>

        {/* the headline, on top of everything */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 10,
            width: size.width,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {title(92)}
        </div>
      </div>
    ),
    { ...size, fonts: [...aAssets.fonts, bebas], headers: CACHE },
  );
}
