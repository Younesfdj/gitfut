"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Crown,
  FastForward,
  Flame,
  FolderGit2,
  GitPullRequest,
  Infinity as InfinityIcon,
  Languages,
  type LucideIcon,
  Shield,
  Star,
  Users,
  Zap,
} from "lucide-react";
import type { Card, Finish, Metric, Playstyle } from "@/lib/scoring/types";
import { languageLogoUrl } from "@/lib/github/languages";
import { formatCount } from "@/lib/format";
import { deEmDash } from "@/lib/text";
import { buildRadarPoints, getRadarStats } from "@/lib/scoring/radar";
import { resolveResultTheme, rgba } from "./finishTheme";

const PLAYSTYLE_ICONS: Record<string, LucideIcon> = {
  star: Star,
  flame: Flame,
  zap: Zap,
  "fast-forward": FastForward,
  infinity: InfinityIcon,
  shield: Shield,
  "git-pull-request": GitPullRequest,
  users: Users,
  languages: Languages,
  "folder-git": FolderGit2,
  clock: Clock,
};

// Hide a logo/image that fails to load (e.g. a CDN miss) rather than show a broken icon.
const hideOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  e.currentTarget.style.display = "none";
};

// The scout's one-line verdict — the signature, in recruitment vernacular.
const VERDICTS: Record<Finish, string> = {
  icon: "Generational talent",
  toty: "Elite prospect",
  totw: "In-form, in demand",
  gold: "First-team ready",
  silver: "Squad rotation",
  bronze: "One to watch",
  founder: "The architect",
};

// Lightweight hover popup explaining why a value was given.
function Tip({
  text,
  align = "center",
  children,
}: {
  text: string;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  const pos = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="group/tip relative inline-flex cursor-help items-center">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full ${pos} z-30 mb-2 hidden w-max max-w-[220px] whitespace-normal rounded-lg border border-white/10 bg-[#17131f] px-3 py-2 text-left text-[12px] font-normal leading-snug text-ink-dim shadow-[0_10px_30px_rgba(0,0,0,.55)] group-hover/tip:block`}
      >
        {text}
      </span>
    </span>
  );
}

function StarRating({ value, accent }: { value: number; accent: string }) {
  return (
    <span className="inline-flex gap-[3px]" style={{ color: accent }} aria-label={`${value} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={15} className={i < value ? "fill-current" : "fill-transparent opacity-25"} />
      ))}
    </span>
  );
}

function AttributeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] py-[11px] last:border-0">
      <span className="text-[13.5px] text-ink-dim">{label}</span>
      <span className="font-display text-[14px] font-bold tracking-[.02em] text-ink-soft">{children}</span>
    </div>
  );
}

// Editorial section: an accent dash + tracked label, then content — reads as a
// scouting-report section rather than a dashboard card.
function Section({
  title,
  accent,
  className,
  children,
}: {
  title?: string;
  accent: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px] ${className ?? ""}`}>
      {title ? (
        <div className="mb-[8px] flex items-center gap-[9px]">
          <span className="h-[2px] w-[16px] rounded-full" style={{ background: accent }} />
          <h3 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">{title}</h3>
        </div>
      ) : null}
      {children}
    </section>
  );
}

function PlaystyleList({ playstyles, accent }: { playstyles: Playstyle[]; accent: string }) {
  if (playstyles.length === 0) {
    return <p className="py-1 text-[13.5px] leading-snug text-ink-mute">No standout traits yet — keep shipping.</p>;
  }
  return (
    <ul className="flex flex-col gap-[11px] pt-1">
      {playstyles.map((p) => {
        const Icon = PLAYSTYLE_ICONS[p.icon] ?? Star;
        return (
          <li key={p.name}>
            <Tip text={p.reason} align="left">
              <Icon size={16} style={{ color: accent }} aria-hidden />
              <span className="ml-[11px] text-[14px] font-medium text-ink-soft">{p.name}</span>
              {p.plus && (
                <span
                  className="font-display ml-[7px] rounded-[5px] px-[5px] text-[11px] font-extrabold leading-[15px]"
                  style={{ background: accent, color: "#0b0a0f" }}
                  title="PlayStyle+"
                >
                  +
                </span>
              )}
            </Tip>
          </li>
        );
      })}
    </ul>
  );
}

function MetricBar({ metric, accent, index = 0 }: { metric: Metric; accent: string; index?: number }) {
  const fill = Math.max(metric.score, 4); // never an empty bar; show a sliver minimum
  // Entrance: each row eases up + its bar sweeps from 0 to value, staggered down
  // the list, so the panel "draws itself" like a live scouting readout.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Set is kept inside the timeout (never synchronous in the effect body) so it
    // can't cascade renders. Reduced motion uses a 0ms delay — the global
    // prefers-reduced-motion reset in globals.css makes the transition instant.
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const t = setTimeout(() => setMounted(true), reduced ? 0 : 120 + index * 55);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(6px)",
        transition: "opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1)",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-dim">{metric.label}</span>
        <span className="flex items-baseline gap-[6px]">
          <span className="text-[11px] tabular-nums text-ink-mute">
            {formatCount(metric.value)}
            {metric.unit ? ` ${metric.unit}` : ""}
          </span>
          <span className="font-display text-[16px] font-bold leading-none tabular-nums" style={{ color: accent }}>
            {metric.score}
          </span>
        </span>
      </div>
      <div className="mt-[7px] h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
          style={{ width: mounted ? `${fill}%` : "0%", background: `linear-gradient(90deg, ${accent}99, ${accent})` }}
        />
      </div>
    </div>
  );
}

// A child that fades + lifts into place on mount, staggered by `step`. Honors
// reduced motion (appears instantly). Powers the header's cascade entrance.
function Stagger({ step, children, className }: { step: number; children: React.ReactNode; className?: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const t = setTimeout(() => setShown(true), reduced ? 0 : 90 + step * 110);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0) scale(1)" : "translateY(10px) scale(.98)",
        transition: "opacity .55s ease, transform .55s cubic-bezier(.16,1,.3,1)",
      }}
    >
      {children}
    </div>
  );
}

// Scouting-dossier header. A left "grade stamp" (the OVR + tier, the scout's
// verdict-at-a-glance) anchors the row; the identity block sits beside it with
// the name as hero, one clean meta line, and the verdict inline. No centered
// stack, no floating pill, no decorative flanking rules.
export function ReportHeader({ card }: { card: Card }) {
  const theme = resolveResultTheme(card);
  const accent = theme.ink;
  return (
    <header className="relative mx-auto flex max-w-[640px] items-center gap-[clamp(16px,3vw,28px)]">
      {/* left — the grade stamp: OVR over tier, the dossier's headline metric */}
      <Stagger step={0} className="shrink-0">
        <div
          className="relative flex h-[clamp(78px,13vw,98px)] w-[clamp(78px,13vw,98px)] flex-col items-center justify-center rounded-2xl border"
          style={{
            borderColor: `${accent}40`,
            background: `linear-gradient(160deg, ${accent}1a, transparent 70%), #161b22`,
            boxShadow: `0 0 30px ${accent}1f, inset 0 1px 0 ${accent}26`,
          }}
        >
          <span
            className="font-display text-[clamp(34px,6vw,46px)] font-black leading-[.82] tabular-nums"
            style={{ color: accent, filter: `drop-shadow(0 1px 8px ${accent}55)` }}
          >
            {card.overall}
          </span>
          <span className="font-display mt-[2px] text-[10px] font-bold tracking-[.22em] text-ink-faint">
            {card.finishLabel}
          </span>
        </div>
      </Stagger>

      {/* right — identity block, left-aligned */}
      <div className="min-w-0 flex-1 text-left">
        <Stagger step={1}>
          <div className="flex items-center gap-[8px]">
            <span className="font-display text-[11px] font-bold tracking-[.3em] text-brand">SCOUT REPORT</span>
            <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
          </div>
        </Stagger>

        <Stagger step={2} className="relative">
          <div
            aria-hidden
            className="animate-glow pointer-events-none absolute -left-[6%] top-1/2 -z-10 h-[160%] w-[70%] -translate-y-1/2 rounded-full blur-[42px]"
            style={{ background: `radial-gradient(closest-side, ${theme.glow}, transparent 72%)` }}
          />
          <h2
            className="font-display mt-[2px] truncate text-[clamp(32px,5.4vw,56px)] font-black leading-[.92]"
            style={{
              backgroundImage: `linear-gradient(100deg, #e6edf3 0%, #e6edf3 38%, ${accent} 50%, #fff 54%, #e6edf3 64%, #e6edf3 100%)`,
              backgroundSize: "220% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 2px 14px ${accent}38)`,
              animation: "gf-name-shimmer 4.5s ease-in-out 0.6s both",
            }}
          >
            {card.name}
          </h2>
        </Stagger>

        <Stagger step={3}>
          <div className="mt-[8px] flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
            <span
              className="font-display inline-flex items-center rounded-[6px] border border-brand/40 bg-brand/15 px-[9px] py-[3px] text-[12.5px] font-bold leading-none tracking-[.14em] text-brand"
            >
              {card.position}
            </span>
            {card.founder && (
              <Tip text={card.founder.tagline}>
                <span
                  className="font-display inline-flex items-center gap-[5px] rounded-[6px] border px-[9px] py-[3px] text-[12.5px] font-bold leading-none tracking-[.14em]"
                  style={{
                    color: card.founder.accent,
                    borderColor: rgba(card.founder.accent, 0.45),
                    background: rgba(card.founder.accent, 0.14),
                  }}
                >
                  <Crown size={13} aria-hidden style={{ fill: card.founder.accent }} />
                  {card.founder.label}
                </span>
              </Tip>
            )}
            <span className="text-[14px] font-medium text-ink-dim">{card.archetype}</span>
            <span aria-hidden className="h-[11px] w-px bg-white/15" />
            <a
              href={`https://github.com/${card.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[13px] text-ink-faint underline-offset-2 transition hover:text-brand hover:underline"
            >
              @{card.login}
            </a>
            {card.topLanguage && (
              <>
                <span aria-hidden className="h-[11px] w-px bg-white/15" />
                <span className="inline-flex items-center gap-[6px] text-[13px] text-ink-dim">
                  {card.languageLogo && (
                    <img
                      src={languageLogoUrl(card.languageLogo.slug)}
                      onError={hideOnError}
                      alt=""
                      aria-hidden
                      className="h-[15px] w-[15px] object-contain"
                    />
                  )}
                  {card.topLanguage}
                </span>
              </>
            )}
          </div>
        </Stagger>

        {/* verdict inline: label + grade, then the blurb continues the sentence */}
        <Stagger step={4}>
          <p className="mt-[9px] line-clamp-2 text-[13.5px] leading-[1.5] text-ink-soft">
            <span className="font-display mr-[7px] text-[11px] font-bold tracking-[.18em]" style={{ color: accent }}>
              {VERDICTS[card.finish].toUpperCase()}
            </span>
            {deEmDash(card.archetypeBlurb)}.
          </p>
        </Stagger>
      </div>
    </header>
  );
}

// Left side: attributes + playstyles.
export function AttributesPanel({ card }: { card: Card }) {
  const accent = resolveResultTheme(card).ink;
  const { report } = card;
  return (
    <div className="flex w-full flex-col gap-[14px]">
      <Section title="ATTRIBUTES" accent={accent}>
        <AttributeRow label="Skill moves">
          <Tip text={report.reasons.skillMoves} align="right">
            <StarRating value={report.skillMoves} accent={accent} />
          </Tip>
        </AttributeRow>
        <AttributeRow label="Weak foot">
          <Tip text={report.reasons.weakFoot} align="right">
            <StarRating value={report.weakFoot} accent={accent} />
          </Tip>
        </AttributeRow>
        <AttributeRow label="Work rate">
          <Tip text={report.reasons.workRate} align="right">
            <span>
              {report.workRate.attack} / {report.workRate.defense}
            </span>
          </Tip>
        </AttributeRow>
        <AttributeRow label="Style">
          <Tip text={report.reasons.style} align="right">
            <span>{report.style}</span>
          </Tip>
        </AttributeRow>
      </Section>

      <Section title="PLAYSTYLES" accent={accent}>
        <PlaystyleList playstyles={report.playstyles} accent={accent} />
      </Section>
    </div>
  );
}

function RadarChart({ card }: { card: Card }) {
  const accent = resolveResultTheme(card).ink;
  const points = buildRadarPoints(card.stats);
  const radarStats = getRadarStats(card.stats);
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
  const chartSize = 140;
  const center = chartSize / 2;
  const maxRadius = 70;
  const grid = [0.25, 0.5, 0.75].map((level) => {
    const radius = maxRadius * level;
    const ringPoints = Array.from({ length: 6 }, (_, index) => {
      const angle = (-Math.PI / 2 + (Math.PI * 2 * index) / 6) % (Math.PI * 2);
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    }).join(" ");
    return { level, ringPoints };
  });
  const axisLabels = radarStats.map((stat, index) => {
    const angle = (-Math.PI / 2 + (Math.PI * 2 * index) / 6) % (Math.PI * 2);
    const labelRadius = maxRadius + 10;
    const x = center + Math.cos(angle) * labelRadius;
    const y = center + Math.sin(angle) * labelRadius;
    const dx = Math.abs(Math.cos(angle)) < 0.2 ? 0 : Math.sign(Math.cos(angle)) * 3;
    const dy = Math.abs(Math.sin(angle)) < 0.2 ? 0 : Math.sign(Math.sin(angle)) * 3;
    const labelWidth = 8 + stat.label.length * 5.2;
    return {
      ...stat,
      x: Math.max(8, Math.min(chartSize - labelWidth - 8, x + dx - labelWidth / 2)),
      y: Math.max(12, Math.min(chartSize - 12, y + dy)),
      width: labelWidth,
    };
  });

  return (
   
      <svg viewBox="0 0 140 140" className="mx-auto block h-[240px] w-full max-w-[280px] shrink-0">
        <rect x="0" y="0" width="140" height="140" rx="18" fill="rgba(255,255,255,0.01)" />
        {grid.map((ring) => (
          <polygon key={ring.level} points={ring.ringPoints} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
        ))}
        {points.map((point, index) => {
          const angle = (-Math.PI / 2 + (Math.PI * 2 * index) / 6) % (Math.PI * 2);
          const x = center + Math.cos(angle) * (maxRadius - 4);
          const y = center + Math.sin(angle) * (maxRadius - 4);
          return <line key={`${point.x}-${point.y}`} x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />;
        })}
        <polygon points={polygon} fill={`${accent}33`} stroke={accent} strokeWidth="1.8" />
        {points.map((point, index) => (
          <circle key={`${index}-${point.x}`} cx={point.x} cy={point.y} r="2.5" fill={accent} />
        ))}
        {axisLabels.map((label) => (
          <text
            key={label.key}
            x={label.x + label.width / 2}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8.5"
            fontWeight="700"
            letterSpacing="0.08em"
            fill="rgba(230, 237, 243, 0.95)"
          >
            {label.label}
          </text>
        ))}
      </svg>
   
  );
}

// Right side: scouting metrics.
export function MetricsPanel({ card }: { card: Card }) {
  const accent = resolveResultTheme(card).ink;
  return (
    <Section accent={accent} className="w-full">
      
      <div className="mb-[10px] flex items-center gap-[9px]">
        <span className="h-[2px] w-[16px] rounded-full" style={{ background: accent }} />
      <h3 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">SCOUTING METRICS
</h3>
      </div>
       
       <div className="flex flex-col gap-[12px]">
        <RadarChart card={card} />
        <div className="flex flex-col gap-[13px] pt-1">
          {card.report.metrics.map((m, i) => (
            <MetricBar key={m.label} metric={m} accent={accent} index={i} />
          ))}
        </div>
      </div>
    </Section>
  );
}
