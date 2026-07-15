"use client";

import { DIST_ACTIVE_COUNTS, DIST_ACTIVE_N, DIST_COUNTS, DIST_MIN, DIST_N } from "@/lib/distribution-data";
import { formatThousands } from "@/lib/format";
import { resolveResultTheme } from "./finishTheme";
import { Tip } from "./ScoutReport";
import type { Card } from "@/lib/scoring/types";

// Small "where you stand" histogram under the scouting metrics: overall rating
// of a uniform random sample of GitHub accounts (scored by this same engine),
// with this card's overall marked. Sqrt-scaled bar heights so the long bronze
// tail doesn't flatten everything right of 60 (the interesting part).
const W = 328;
const H = 64;
const PAD_TOP = 14;
const X_MAX = 100;

export default function DistributionPanel({ card }: { card: Card }) {
  const accent = resolveResultTheme(card).ink;
  const maxCount = Math.max(...DIST_COUNTS);
  const span = X_MAX - DIST_MIN;
  const barW = W / span;
  const xFor = (rating: number) => ((Math.min(Math.max(rating, DIST_MIN), X_MAX) - DIST_MIN) / span) * W;
  const hFor = (c: number) => (Math.sqrt(c) / Math.sqrt(maxCount)) * (H - PAD_TOP);

  const meX = xFor(card.overall + 0.5);

  // "Top X%" = share of the population rated at least this card's overall. When
  // nothing in the sample reaches it, the honest claim is the rule-of-three
  // bound: at 95% confidence the true share is below 3/n.
  const fmtPct = (p: number) => (p >= 10 ? `${Math.round(p)}` : p >= 1 ? p.toFixed(1) : p.toFixed(2));
  const top = (counts: number[], n: number) => {
    const atOrAbove = counts.reduce((s, c, i) => s + (DIST_MIN + i >= card.overall ? c : 0), 0);
    const pct = atOrAbove > 0 ? (100 * atOrAbove) / n : (100 * 3) / n;
    return { atOrAbove, label: `Top ${atOrAbove > 0 ? "" : "< "}${fmtPct(pct)}%` };
  };
  const all = top(DIST_COUNTS, DIST_N);
  const act = top(DIST_ACTIVE_COUNTS, DIST_ACTIVE_N);
  // Numbers in a <Tip> text node become part of the SSR HTML and are compared
  // byte-for-byte at hydration — using formatThousands (locale-locked to en-US)
  // prevents "5,000" vs "5.000" mismatches when the user's browser locale isn't
  // the Node server's default.
  const tipText =
    `Higher than ${formatThousands(DIST_N - all.atOrAbove)} of ${formatThousands(DIST_N)} randomly sampled GitHub users, ` +
    `and ${formatThousands(DIST_ACTIVE_N - act.atOrAbove)} of the ${formatThousands(DIST_ACTIVE_N)} who were active in the past year.`;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px]">
      <div className="mb-[8px] flex items-center gap-[9px]">
        <span className="h-[2px] w-[16px] rounded-full" style={{ background: accent }} />
        <h3 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">DISTRIBUTION</h3>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label={`Overall rating ${card.overall} versus a random sample of ${DIST_N} GitHub accounts`}>
        {DIST_COUNTS.map((c, i) =>
          c === 0 ? null : (
            <rect
              key={i}
              x={xFor(DIST_MIN + i) + 0.5}
              y={H - hFor(c)}
              width={Math.max(barW - 1, 1.5)}
              height={hFor(c)}
              rx={1}
              className="fill-white/25"
            />
          ),
        )}
        {/* this card */}
        <line x1={meX} y1={PAD_TOP - 2} x2={meX} y2={H} stroke={accent} strokeWidth={1.4} strokeDasharray="3 2.5" opacity={0.9} />
        <circle cx={meX} cy={H} r={3} fill={accent} />
        <text
          x={meX}
          y={PAD_TOP - 6}
          textAnchor={card.overall > 88 ? "end" : card.overall < 62 ? "start" : "middle"}
          fill={accent}
          fontSize={9.5}
          fontWeight={700}
          letterSpacing={1}
        >
          {card.login.toLowerCase()} · {card.overall}
        </text>
        {/* axis labels */}
        {[50, 60, 70, 80, 90, 100].map((x) => (
          <text key={x} x={xFor(x)} y={H + 12} textAnchor={x === 100 ? "end" : x === 50 ? "start" : "middle"} fontSize={8.5} className="fill-ink-mute">
            {x}
          </text>
        ))}
      </svg>
      <p className="mt-[7px] text-[11.5px] leading-snug text-ink-mute">
        <Tip text={tipText} align="left">
          <span>
            <span className="font-display text-[11px] font-bold tracking-[.14em]" style={{ color: accent }}>
              {all.label.toUpperCase()}
            </span>
            <span className="ml-[6px]">of GitHub</span>
            <span aria-hidden className="mx-[8px] inline-block h-[10px] w-px bg-white/15 align-[-1px]" />
            <span className="font-display text-[11px] font-bold tracking-[.14em]" style={{ color: accent }}>
              {act.label.toUpperCase()}
            </span>
            <span className="ml-[6px]">of active devs</span>
          </span>
        </Tip>
      </p>
    </section>
  );
}
