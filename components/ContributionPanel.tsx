"use client";

import { useMemo, type CSSProperties } from "react";
import type { Card } from "@/lib/scoring/types";
import { buildContributionPanel, type ContributionCell } from "@/lib/contributions";
import { GRID_CELL, GRID_PITCH, GRID_RADIUS, GRID_GREEN, GRID_EMPTY } from "./Background";
import { resolveResultTheme } from "./finishTheme";

// Real per-user contribution graph — same cell geometry + green as the
// decorative motif in Background.tsx (see GRID_* there), so the result page
// never shows two different-looking grids. Levels 1-4 are quartiles of this
// user's OWN active days (see lib/contributions), rendered as the same green
// at increasing (but capped, muted) opacity over the same dim, unlit fill —
// deliberately softer than a literal github.com graph so it reads as ambient
// texture alongside the other panels, not a loud, high-contrast widget.
const LEVEL_OPACITY: Record<ContributionCell["level"], number> = { 0: 0, 1: 0.22, 2: 0.4, 3: 0.58, 4: 0.8 };
const LABEL_H = 16; // room for month labels above the grid

export default function ContributionPanel({ card }: { card: Card }) {
  const data = useMemo(() => buildContributionPanel(card.contributionDays ?? []), [card.contributionDays]);
  const accent = resolveResultTheme(card).ink;

  if (data.weeks.length === 0) return null;

  const cols = data.weeks.length;
  const width = cols * GRID_PITCH;
  const height = LABEL_H + 7 * GRID_PITCH;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px]">
      <div className="mb-[10px] flex flex-wrap items-baseline justify-between gap-x-[12px] gap-y-[4px]">
        <div className="flex items-center gap-[9px]">
          <span className="h-[2px] w-[16px] rounded-full" style={{ background: accent }} />
          <h3 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">CONTRIBUTIONS</h3>
        </div>
        <p className="text-[12.5px] text-ink-mute">
          <span className="font-display font-bold tabular-nums text-ink-soft">{data.total.toLocaleString()}</span> in
          the last year
          {data.currentStreak > 1 && (
            <>
              {" "}
              · <span style={{ color: accent }}>{data.currentStreak}-day streak</span>
            </>
          )}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block h-auto w-full"
        style={{ maxWidth: width }}
        role="img"
        aria-label={`${data.total.toLocaleString()} contributions in the last year`}
      >
        {data.monthLabels.map(({ weekIndex, label }) => (
          <text
            key={weekIndex}
            x={weekIndex * GRID_PITCH}
            y={LABEL_H - 5}
            fontSize={9.5}
            fontWeight={600}
            className="fill-ink-mute"
          >
            {label}
          </text>
        ))}
        {data.weeks.map((week, w) =>
          week.map((cell, d) => {
            if (!cell) return null;
            const isLatest = cell.date === data.latestDate;
            return (
              <rect
                key={cell.date}
                x={w * GRID_PITCH}
                y={LABEL_H + d * GRID_PITCH}
                width={GRID_CELL}
                height={GRID_CELL}
                rx={GRID_RADIUS}
                fill={cell.level === 0 ? GRID_EMPTY : GRID_GREEN}
                fillOpacity={cell.level === 0 ? 1 : LEVEL_OPACITY[cell.level]}
                className={isLatest && cell.level > 0 ? "gf-grid-cell" : undefined}
                style={isLatest && cell.level > 0 ? ({ "--gf-dur": "2.4s" } as CSSProperties) : undefined}
              >
                <title>{`${cell.count} contribution${cell.count === 1 ? "" : "s"} on ${cell.date}`}</title>
              </rect>
            );
          }),
        )}
      </svg>
    </section>
  );
}
