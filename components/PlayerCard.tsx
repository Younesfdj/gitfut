"use client";

import { memo, type CSSProperties } from "react";
import type { Card, StatKey } from "@/lib/scoring/types";
import { languageLogoUrl } from "@/lib/github/languages";
import { CARD_THEME } from "./finishTheme";

// Faithful port of the Python FUT generator's 540×820 layout. Positions are
// percentages of the card (x/540, y/820); font sizes are cqw (px/540×100) so the
// card scales with its container. The tier background PNG carries the artwork;
// everything else (rating, name, stats, flag, club, separator lines) is overlaid
// here exactly where PIL drew it.

const AVATAR_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="%23000" fill-opacity="0"/><circle cx="160" cy="128" r="62" fill="%23ffffff" fill-opacity="0.18"/><rect x="58" y="206" width="204" height="150" rx="80" fill="%23ffffff" fill-opacity="0.18"/></svg>',
  );

const FONT_MEDIUM = "var(--font-din-medium), 'Saira Condensed', sans-serif";
const FONT_COND = "var(--font-din-cond), 'Saira Condensed', sans-serif";
const FONT_BOLD = "var(--font-din-bold), 'Saira Condensed', sans-serif";

// Avatar feather from the Claude Design card: a radial ellipse (clear centre →
// transparent edge) intersected with a bottom fade and a top fade. The opaque
// cores are widened from the design (46→56, 56→62) so the middle reads more
// obvious/clear. Raise those #000 stops for an even bigger clear centre.
const AVATAR_MASK =
  "radial-gradient(ellipse 66% 88% at 52% 40%, #000 56%, transparent 80%), linear-gradient(220deg, #000 70%, transparent 100%), linear-gradient(180deg, transparent 1%, #000 22%)";

const pad2 = (n: number) => String(Math.round(n)).padStart(2, "0");

// value/label positions per stat (Python col x115/305 + label gap 60; rows 530/592/654, labels +5).
const STAT_CELLS: {
  k: StatKey;
  l: string;
  vx: number;
  lx: number;
  vy: number;
  ly: number;
}[] = [
  { k: "pac", l: "PAC", vx: 21.3, lx: 32.41, vy: 64.63, ly: 65.24 },
  { k: "dri", l: "DRI", vx: 56.48, lx: 67.59, vy: 64.63, ly: 65.24 },
  { k: "sho", l: "SHO", vx: 21.3, lx: 32.41, vy: 72.2, ly: 72.8 },
  { k: "def", l: "DEF", vx: 56.48, lx: 67.59, vy: 72.2, ly: 72.8 },
  { k: "pas", l: "PAS", vx: 21.3, lx: 32.41, vy: 79.76, ly: 80.37 },
  { k: "phy", l: "PHY", vx: 56.48, lx: 67.59, vy: 79.76, ly: 80.37 },
];

// Separator lines PIL draws over the blank card art. [left%, top%, width%].
const H_LINES: [number, number, number][] = [
  [19.44, 31.1, 10.19], // under position
  [19.44, 40.85, 10.19], // under flag
  [16.67, 64.02, 66.67], // under name
  [44.44, 89.63, 11.11], // under stats
];

const hideOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  e.currentTarget.style.visibility = "hidden";
};

function PlayerCard({ card }: { card: Card }) {
  const t = CARD_THEME[card.finish];
  const ink = t.ink;
  const full = card.name.trim();
  const displayName = (
    full.length <= 9 ? full : full.split(" ").slice(-1)[0]
  ).toUpperCase();

  const onAvatarError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = AVATAR_FALLBACK;
  };

  const wrap: CSSProperties = {
    containerType: "inline-size",
    position: "relative",
    width: "100%",
    aspectRatio: "540 / 820",
    filter: `drop-shadow(0 7cqw 10cqw rgba(0,0,0,.5)) drop-shadow(0 0 6cqw ${t.glow})`,
  };

  const at = (left: number, top: number): CSSProperties => ({
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
  });

  return (
    <div style={wrap}>
      {/* tier background art */}
      <img
        src={t.bg}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
        }}
      />

      {/* Avatar — clipped to the card silhouette (the bg PNG used as a mask) so
          it can never spill past the frame, then feathered + colour-tinted so
          any photo, logo or anime blends in like a FUT cut-out. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage: `url("${t.bg}")`,
          maskImage: `url("${t.bg}")`,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "27cqw",
            top: "13cqw",
            width: "68cqw",
            height: "70cqw",
            WebkitMaskImage: AVATAR_MASK,
            maskImage: AVATAR_MASK,
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
            filter: `drop-shadow(0 3cqw 6cqw rgba(0,0,0,.5)) drop-shadow(0 0 5cqw ${t.avatarHalo})`,
          }}
        >
          <img
            src={card.avatarUrl}
            onError={onAvatarError}
            alt={card.login}
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 20%",
            }}
          />
          <div
            style={{ position: "absolute", inset: 0, background: t.avatarTint }}
          />
        </div>
      </div>

      {/* separator lines */}
      {H_LINES.map(([l, top, w], i) => (
        <div
          key={i}
          style={{
            ...at(l, top),
            width: `${w}%`,
            height: "0.3cqw",
            background: ink,
            opacity: 0.5,
          }}
        />
      ))}
      <div
        style={{
          ...at(50, 66.46),
          width: "0.3cqw",
          height: "20.12%",
          background: ink,
          opacity: 0.5,
        }}
      />

      {/* overall */}
      <div
        style={{
          ...at(16.3, 9.76),
          fontFamily: FONT_MEDIUM,
          fontSize: "22.2cqw",
          fontWeight: 500,
          lineHeight: 1,
          color: ink,
        }}
      >
        {pad2(card.overall)}
      </div>

      {/* position (centered around the left column) */}
      <div
        style={{
          ...at(25, 23.78),
          transform: "translateX(-50%)",
          fontFamily: FONT_COND,
          fontSize: "9.3cqw",
          fontWeight: 500,
          letterSpacing: ".02em",
          color: ink,
        }}
      >
        {card.position}
      </div>

      {/* country flag — only when a country was resolved from the GitHub location */}
      {card.country && (
        <img
          src={`/badges/flags/${card.country}.png`}
          onError={hideOnError}
          alt={card.country}
          style={{
            ...at(17.59, 33.17),
            width: "14.81%",
            height: "5.73%",
            objectFit: "contain",
          }}
        />
      )}

      {/* top language logo — a transparent PNG in the left identity column (under
          the flag), taking the slot the club badge used to occupy. The catalog's
          PNGs are full-colour on a transparent background, so they read on the
          card art with no plate. crossOrigin keeps html-to-image export untainted;
          onError hides it on a CDN miss. Cards without a logo leave the slot empty. */}
      {card.languageLogo && (
        <img
          src={languageLogoUrl(card.languageLogo.slug)}
          crossOrigin="anonymous"
          onError={hideOnError}
          alt={card.languageLogo.name}
          title={card.languageLogo.name}
          style={{
            // Sized down from the old club-badge slot then nudged back up 25%,
            // kept centred on the same point (so it stays under the flag).
            ...at(19.06, 42.25),
            width: "11.875%",
            height: "7.5%",
            objectFit: "contain",
          }}
        />
      )}

      {/* name (centered across the card) */}
      <div
        style={{
          ...at(50, 53.66),
          transform: "translateX(-50%)",
          fontFamily: FONT_BOLD,
          fontSize: "13cqw",
          fontWeight: 700,
          whiteSpace: "nowrap",
          color: ink,
        }}
      >
        {displayName}
      </div>

      {/* six stats */}
      {STAT_CELLS.map((c) => (
        <div key={c.k}>
          <span
            style={{
              ...at(c.vx, c.vy),
              fontFamily: FONT_BOLD,
              fontSize: "10.2cqw",
              fontWeight: 700,
              color: ink,
            }}
          >
            {pad2(card.stats[c.k])}
          </span>
          <span
            style={{
              ...at(c.lx, c.ly),
              fontFamily: FONT_COND,
              fontSize: "9.3cqw",
              fontWeight: 500,
              letterSpacing: ".02em",
              color: ink,
            }}
          >
            {c.l}
          </span>
        </div>
      ))}
    </div>
  );
}

export default memo(PlayerCard);
