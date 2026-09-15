"use client";

import { forwardRef, type CSSProperties } from "react";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";
import VsBurst from "./VsBurst";
import { duelThemes } from "./finishTheme";
import { tallyRows, type Duel } from "@/lib/duel";

const STORY_W = 1080;
const STORY_H = 1920;

const SAFE_TOP = 250;
const SAFE_BOTTOM = 250;
const SAFE_H = STORY_H - SAFE_TOP - SAFE_BOTTOM;

const CARD_W = 440;
const CARD_H = Math.round(CARD_W * (820 / 540)); // ≈ 668

const BRAND = "#39d353";

function rgbaGlow(glow: string, alpha: number): string {
  const m = glow.match(/rgba?\(([^)]+)\)/);
  if (!m) return glow;
  const [r, g, b] = m[1].split(",").map((s) => s.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const FONT_DISPLAY = "var(--font-bebas), 'Saira Condensed', sans-serif";
const FONT_COND = "var(--font-din-cond), 'Saira Condensed', sans-serif";

const DuelStoryFrame = forwardRef<HTMLDivElement, { duel: Duel }>(function DuelStoryFrame(
  { duel },
  ref,
) {
  const { challenger, opponent, rows, onPenalties, winner } = duel;
  const { home: aTheme, away: bTheme } = duelThemes(challenger, opponent);
  
  // Use ALL rows since the exported story represents the final settled duel
  const { a: scoreA, b: scoreB } = tallyRows(rows);

  // Optical centring
  const cardTop = SAFE_TOP + 240;

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
        background: `
          radial-gradient(120% 100% at 50% 42%, transparent 34%, rgba(0,0,0,0.72) 100%),
          #07090d
        `,
      }}
    >
      {/* Background split wash */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(130% 130% at 0% 0%, ${rgbaGlow(aTheme.glow, 0.35)}, transparent 65%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(130% 130% at 100% 100%, ${rgbaGlow(bTheme.glow, 0.35)}, transparent 65%)` }} />

      {/* top — brand wordmark + concept line */}
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
          SCOUT DUEL
        </div>
      </div>

      {/* centre — the cards and VS burst */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: cardTop,
          transform: "translateX(-50%)",
          width: 1040,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ width: CARD_W, position: "relative", transform: winner === "challenger" ? "scale(1.05)" : winner === "opponent" ? "scale(0.95)" : "scale(1)", transition: "transform 0s" }}>
          <div style={{ position: "absolute", inset: "-3%", borderRadius: "8%", background: `radial-gradient(closest-side, transparent 60%, ${rgbaGlow(aTheme.glow, 0.85)} 86%, transparent 100%)`, filter: "blur(16px)", zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1, filter: `drop-shadow(0 30px 60px rgba(0,0,0,0.7))` }}>
            <PlayerCard card={challenger} />
          </div>
        </div>

        <div style={{ zIndex: 2, filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.8))", marginTop: -30 }}>
          <VsBurst size={130} />
        </div>

        <div style={{ width: CARD_W, position: "relative", transform: winner === "opponent" ? "scale(1.05)" : winner === "challenger" ? "scale(0.95)" : "scale(1)", transition: "transform 0s" }}>
          <div style={{ position: "absolute", inset: "-3%", borderRadius: "8%", background: `radial-gradient(closest-side, transparent 60%, ${rgbaGlow(bTheme.glow, 0.85)} 86%, transparent 100%)`, filter: "blur(16px)", zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1, filter: `drop-shadow(0 30px 60px rgba(0,0,0,0.7))` }}>
            <PlayerCard card={opponent} />
          </div>
        </div>
      </div>

      {/* Scoreline */}
      <div style={abs(cardTop + CARD_H + 90)}>
        <div style={{ display: "flex", alignItems: "center", gap: 32, fontSize: 160, fontWeight: 900, lineHeight: 0.9 }}>
          <span style={{ color: aTheme.ink, textShadow: winner === "challenger" ? `0 0 40px ${rgbaGlow(aTheme.ink, 0.4)}` : undefined }}>{scoreA}</span>
          <span style={{ fontSize: 90, color: "rgba(255,255,255,0.2)" }}>–</span>
          <span style={{ color: bTheme.ink, textShadow: winner === "opponent" ? `0 0 40px ${rgbaGlow(bTheme.ink, 0.4)}` : undefined }}>{scoreB}</span>
        </div>
        {onPenalties && (
          <div style={{ marginTop: 24, fontSize: 32, color: "#f1e582", letterSpacing: "0.2em" }}>AFTER PENALTIES</div>
        )}
      </div>

      {/* bottom — the CTA */}
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
          START A DUEL ON GITFUT.COM
          <span style={{ fontSize: 48 }}>→</span>
        </div>
      </div>
    </div>
  );
});

export default DuelStoryFrame;
