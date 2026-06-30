"use client";

import { forwardRef, type CSSProperties } from "react";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";
import { resolveCardTheme, resolveResultTheme } from "./finishTheme";

// Instagram Story canvas (9:16). The frame renders at native resolution: the
// captured PNG IS these pixels, so the on-page card's pixelRatio:3 upscale is
// unnecessary — CardActions captures the story at pixelRatio:1.
const STORY_W = 1080;
const STORY_H = 1920;

// Instagram overlays its own chrome on the top (~profile/close) and bottom
// (~caption / "Send message" / reactions) of every story. Keep all content
// inside this band so the wordmark and — critically — the CTA are never
// occluded. Designing for the full 1080×1920 designs for a canvas IG never
// actually shows.
const SAFE_TOP = 250;
const SAFE_BOTTOM = 250;
const SAFE_H = STORY_H - SAFE_TOP - SAFE_BOTTOM; // 1420px usable

// Card width chosen so its height fits the hero zone between the top
// (wordmark + tagline) and bottom (archetype + CTA) blocks, leaving real
// breathing room. ~606px → height ≈ 606 × 820/540 ≈ 920px.
const CARD_W = 606;
const CARD_H = Math.round(CARD_W * (820 / 540)); // ≈ 920

const BRAND = "#39d353";

// theme.glow is already an `rgba(r,g,b,a)` string (finishTheme.ts). Re-alpha it
// so we can reuse the tier hue at a chosen opacity for the room wash.
function rgbaGlow(glow: string, alpha: number): string {
  const m = glow.match(/rgba?\(([^)]+)\)/);
  if (!m) return glow;
  const [r, g, b] = m[1].split(",").map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const FONT_DISPLAY = "var(--font-bebas), 'Saira Condensed', sans-serif";
const FONT_BOLD = "var(--font-din-bold), 'Saira Condensed', sans-serif";
const FONT_COND = "var(--font-din-cond), 'Saira Condensed', sans-serif";

// Archetype is the card's caption — one line, always. Long archetypes shrink
// rather than wrap into the CTA below. Deterministic length→size (no DOM
// measurement) keeps the off-screen capture stable.
function archetypeSize(label: string): number {
  const n = label.length;
  if (n <= 12) return 58;
  if (n <= 18) return 48;
  if (n <= 24) return 40;
  return 34;
}

// Hidden, fixed-size story canvas wrapping the existing PlayerCard. Mounted once
// (off-screen) in ResultView so renderCardImage can clone + capture it through
// the same proven pipeline as the card — no separate Satori layout, no second
// React root. PlayerCard itself is untouched (the FUT homage stays pure); all
// story styling lives in this frame.
const StoryFrame = forwardRef<HTMLDivElement, { card: Card }>(function StoryFrame(
  { card },
  ref,
) {
  const theme = resolveCardTheme(card);
  const accent = resolveResultTheme(card).ink;
  const archetype = card.archetype.toUpperCase();

  // Optical centring: a tall card true-centred reads low (the eye weights the
  // top + drop shadow), so the hero zone sits slightly high in the safe band.
  // Card top = safe top + top block + a measured gap.
  const cardTop = SAFE_TOP + 296; // push the card down so the lower third (archetype
  // + CTA) isn't crammed at the bottom — balances the vertical composition.

  const abs = (top: number): CSSProperties => ({
    position: "absolute",
    left: 0,
    right: 0,
    top,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  });

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "relative",
        width: STORY_W,
        height: STORY_H,
        overflow: "hidden",
        fontFamily: FONT_DISPLAY,
        // Neutral near-black stage. The tier colour tints the ROOM (a soft, low-
        // opacity top wash) but is kept far from the card's own saturation, and a
        // strong corner vignette darkens the edges — so whatever the card's hue
        // (red on red, grey on grey, navy on navy), the card stays the most
        // saturated/brightest object and lifts off the surface. The figure/ground
        // separation comes from the rim glow + shadow around the card itself
        // (below), not from a same-hue spotlight that the card dissolves into.
        background: `
          radial-gradient(72% 38% at 50% 6%, ${rgbaGlow(theme.glow, 0.36)}, transparent 72%),
          radial-gradient(120% 100% at 50% 42%, transparent 34%, rgba(0,0,0,0.72) 100%),
          #07090d
        `,
      }}
    >
      {/* top — brand wordmark + concept line (sets the frame before the bait) */}
      <div style={abs(SAFE_TOP + 8)}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 88,
            letterSpacing: "0.06em",
            lineHeight: 1,
            color: "#ffffff",
          }}
        >
          GIT<span style={{ color: BRAND }}>FUT</span>
        </div>
        <div
          style={{
            marginTop: 20,
            fontFamily: FONT_COND,
            fontSize: 34,
            letterSpacing: "0.4em",
            color: "rgba(255,255,255,0.86)",
            textTransform: "uppercase",
          }}
        >
          Your GitHub, Scouted
        </div>
      </div>

      {/* centre — the card, lit by a tier glow halo so it floats off the stage */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: cardTop,
          transform: "translateX(-50%)",
          width: CARD_W,
        }}
      >
        {/* Separator stack — what actually lifts the card off the stage on
            EVERY tier (red-on-red, grey-on-grey, navy-on-navy):
            (a) a dark "moat" that deepens the immediate surround, then
            (b) a tight tier-tinted rim glow hugging the card edges for colour
            lift, then (c) a strong drop shadow for depth. The card ends up the
            most saturated, brightest, edge-defined object in frame. */}
        <div
          style={{
            position: "absolute",
            inset: "-9%",
            borderRadius: "8%",
            background: "radial-gradient(closest-side, transparent 58%, rgba(0,0,0,0.62) 100%)",
            filter: "blur(22px)",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "-3%",
            borderRadius: "8%",
            background: `radial-gradient(closest-side, transparent 60%, ${rgbaGlow(theme.glow, 0.85)} 86%, transparent 100%)`,
            filter: "blur(16px)",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            filter: `drop-shadow(0 30px 60px rgba(0,0,0,0.7)) drop-shadow(0 0 1px rgba(255,255,255,0.25))`,
          }}
        >
          <PlayerCard card={card} />
        </div>
      </div>

      {/* archetype — the card's caption (one line, tier accent), tucked just
          below the card so it reads as the player's title. */}
      <div style={abs(cardTop + CARD_H + 36)}>
        <div
          style={{
            fontFamily: FONT_BOLD,
            fontSize: archetypeSize(archetype),
            fontWeight: 700,
            letterSpacing: "0.02em",
            lineHeight: 1,
            color: accent,
            textAlign: "center",
            whiteSpace: "nowrap",
            maxWidth: STORY_W - 120,
          }}
        >
          {archetype}
        </div>
      </div>

      {/* bottom — the CTA: the loudest text in the lower frame (brand green +
          arrow), with the bare domain under it. Pinned inside the safe band so
          IG's bottom bar never eats the conversion. No button container — the
          story isn't tappable, so it reads as a confident headline, not a fake
          tap target. Bookends the green "GITFUT" up top. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: SAFE_BOTTOM + 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 56,
            letterSpacing: "0.04em",
            lineHeight: 1,
            color: BRAND,
            display: "flex",
            alignItems: "center",
            gap: 18,
            whiteSpace: "nowrap",
          }}
        >
          TRY YOUR CARD ON GITFUT.COM
          <span style={{ fontSize: 48 }}>→</span>
        </div>
      </div>
    </div>
  );
});

export default StoryFrame;
