"use client";

import { useState } from "react";
import { radarGeometry, radarSector } from "@/lib/radar";
import { STAT_LABELS, STATS } from "@/lib/scoring/constants";
import type { Stats } from "@/lib/scoring/types";
import { rgba } from "./finishTheme";

const SIZE = 150; // viewBox unit — the svg scales to its container width

interface Rival {
  stats: Stats;
  accent: string;
}

export default function StatRadar({
  stats,
  accent,
  rival,
}: {
  stats: Stats;
  accent: string;
  rival?: Rival;
}) {
  const geo = radarGeometry(stats, SIZE);
  const outer = geo.rings.length - 1;
  const [active, setActive] = useState<number | null>(null);
  const dimmed = (i: number) => active !== null && active !== i;

  const activeLabel = active !== null ? geo.labels[active] : null;
  const activeKey = active !== null ? STATS[active] : null;
  const value = activeKey ? stats[activeKey] : 0;
  const rivalValue = activeKey && rival ? rival.stats[activeKey] : null;
  const read =
    rivalValue === null
      ? ""
      : value > rivalValue
        ? "takes it"
        : value < rivalValue
          ? "drops it"
          : "dead level";

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full">
        {geo.rings.map((ring, i) => (
          <polygon
            key={ring}
            points={ring}
            fill="none"
            stroke={
              i === outer ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.05)"
            }
          />
        ))}

        {/* the focused wedge — the active stat's whole sector takes the light */}
        {active !== null && (
          <polygon
            points={geo.sectors[active]}
            fill={rgba(accent, 0.13)}
            stroke={rgba(accent, 0.3)}
            style={{ animation: "pop .16s cubic-bezier(.16,1,.3,1) both" }}
          />
        )}

        {/* the stat shape — recedes a touch while a sector is focused */}
        <polygon
          points={geo.points}
          fill={rgba(accent, active !== null ? 0.18 : 0.28)}
          stroke={accent}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeOpacity={active !== null ? 0.55 : 1}
          style={{ transition: "fill .25s ease, stroke-opacity .25s ease" }}
        />

        {/* active spoke — ties the popped stat back to its vertex */}
        {active !== null && (
          <line
            x1={geo.center}
            y1={geo.center}
            x2={geo.vertices[active].x}
            y2={geo.vertices[active].y}
            stroke={rgba(accent, 0.6)}
            strokeWidth="1.2"
          />
        )}

        {geo.vertices.map((v, i) => (
          <circle
            key={geo.labels[i].label}
            cx={v.x}
            cy={v.y}
            r={active === i ? 3.6 : 2}
            fill={accent}
            opacity={dimmed(i) ? 0.3 : 1}
            style={{ transition: "r .2s ease, opacity .25s ease" }}
          />
        ))}

        {geo.labels.map((l, i) => (
          <text
            key={l.label}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-display"
            letterSpacing="1"
            fill={active === i ? accent : "var(--color-ink-faint)"}
            opacity={dimmed(i) ? 0.3 : 1}
            style={{
              fontSize: active === i ? 11 : 9.5,
              transition: "opacity .25s ease, font-size .2s ease",
            }}
          >
            {l.label}
          </text>
        ))}

        {/* hit zones — the full wedge, oversized past the labels, FIFA-style.
            role=button keeps the Duel's tap-to-skip from hijacking the tap. */}
        {STATS.map((key, i) => (
          <polygon
            key={key}
            points={radarSector(geo.center, geo.radius + 17, i)}
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`${STAT_LABELS[key]} ${stats[key]}${rival ? ` versus ${rival.stats[key]}` : ""}`}
            className="cursor-pointer focus:outline-none"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive((a) => (a === i ? null : a))}
            onClick={() => setActive((a) => (a === i ? null : i))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActive((a) => (a === i ? null : i));
              }
            }}
          />
        ))}
      </svg>

      {/* the pop-up — the stat's head-to-head, anchored to its corner */}
      {activeLabel && activeKey && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-[10px] py-[6px] text-center shadow-[0_10px_28px_-8px_rgba(0,0,0,.7)]"
          style={{
            left: `${(activeLabel.x / SIZE) * 100}%`,
            top: `${(activeLabel.y / SIZE) * 100}%`,
            transform: "translate(-50%, calc(-100% - 8px))",
            animation: "pop .16s cubic-bezier(.16,1,.3,1) both",
          }}
        >
          <div className="font-display text-[9.5px] font-bold tracking-[.22em] text-ink-faint">
            {STAT_LABELS[activeKey]}
          </div>
          <div
            className="font-display mt-[2px] text-[19px] leading-none tabular-nums"
            style={{ color: accent }}
          >
            {value}
            {rivalValue !== null && (
              <>
                <span className="mx-[5px] text-[11px] text-ink-mute">vs</span>
                <span className="text-[15px]" style={{ color: rival!.accent }}>
                  {rivalValue}
                </span>
              </>
            )}
          </div>
          {rivalValue !== null && (
            <div className="mt-[2px] text-[9.5px] text-ink-mute">{read}</div>
          )}
        </div>
      )}
    </div>
  );
}
