"use client";

import { useEffect, useRef, useState } from "react";

// The six GitHub signals behind each stat — accurate to the engine (PACE is a
// year of ALL contribution types, not just commits).
const READS = [
  { abbr: "PAC", gloss: "A year of commits, PRs, reviews & issues" },
  { abbr: "SHO", gloss: "Stars earned, and your biggest single hit" },
  { abbr: "PAS", gloss: "PRs into other people's repos, plus followers" },
  { abbr: "DRI", gloss: "Your language range — broad helps, but the 10th counts for less" },
  { abbr: "DEF", gloss: "Code reviews and issues closed" },
  { abbr: "PHY", gloss: "A lifetime of contributions over your active years" },
];

// How the scout reads you — the three things that make a card a fingerprint
// rather than a score. These are independent truths, not steps, so no 01/02/03.
const LAWS = [
  {
    kicker: "MEASURED AGAINST YOU",
    lead: "Your own curve, not the world's.",
    body: "Each stat is weighed against the rest of your profile, so a high one marks where you stand out and a low one where you don't. That's why your weakest area can read lower than the raw number suggests — the card grades you on you.",
  },
  {
    kicker: "EVERY CARD HAS A SHAPE",
    lead: "Nobody's elite at everything.",
    body: "Your strongest signals get pushed up and your weakest pulled down, so the card leans instead of sitting flat. That lean is what decides your position and archetype — read off your stats, never picked.",
  },
  {
    kicker: "THE 90s ARE EARNED",
    lead: "One big year won't crown you.",
    body: "Stats top out at 88 on their own. The 90s take years on the clock and influence that lasts, so a legend rating is a track record, not a hot streak.",
    gold: true,
  },
];

// The finish ladder, low to legend — order carries meaning, hence the arrows.
const LADDER = [
  { label: "BRONZE", bg: "#2A1A0C", ink: "#F0CFA8" },
  { label: "SILVER", bg: "#262B33", ink: "#D6DCE6" },
  { label: "GOLD", bg: "#3A2806", ink: "#F3D679" },
  { label: "IN-FORM", bg: "#4A0A14", ink: "#FFD3D9" },
  { label: "TOTY", bg: "#10254F", ink: "#CADBFF" },
  { label: "ICON", bg: "#2A1A45", ink: "#F3D688" },
];

export default function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  // Close on Escape, move focus into the dialog, and play a subtle entrance
  // (the global reduced-motion reset makes the transition instant when asked).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    const t = setTimeout(() => setShown(true), 10);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-deep/80 p-[22px] backdrop-blur-[6px]"
      style={{ opacity: shown ? 1 : 0, transition: "opacity .25s ease" }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hiw-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-[min(600px,100%)] overflow-auto rounded-[20px] border border-line bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-panel))] p-[clamp(24px,4.5vw,40px)] shadow-[0_40px_120px_rgba(0,0,0,.6)] outline-none"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0) scale(1)" : "translateY(14px) scale(.985)",
          transition: "opacity .4s ease, transform .45s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* brand wash bleeding in along the top edge */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(57,211,83,.55), transparent)" }}
        />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[15px] text-ink-faint transition hover:bg-white/10 hover:text-ink"
        >
          ✕
        </button>

        {/* hero — the thesis: we read you, we don't rate you */}
        <div className="font-mono mb-[14px] text-[11px] font-semibold tracking-[.32em] text-brand">
          THE SCOUT&apos;S EYE
        </div>
        <h3
          id="hiw-title"
          className="font-display m-0 text-[clamp(30px,5.4vw,44px)] font-black leading-[.95] tracking-[-.01em]"
        >
          We don&apos;t rate you.
          <br />
          We read you<span className="text-brand">.</span>
        </h3>
        <p className="m-0 mt-[15px] max-w-[47ch] text-[14.5px] leading-[1.55] text-ink-dim">
          Six signals off your live GitHub, weighed against each other to find your shape. That shape is your card — so
          two devs with the same numbers still walk out different. Here&apos;s how to read yours.
        </p>

        {/* the three laws — hairline-separated, scout-vocab kickers */}
        <div className="mt-[26px] flex flex-col">
          {LAWS.map((law) => {
            const accent = law.gold ? "var(--color-gold-hi)" : "var(--color-brand)";
            return (
              <div key={law.kicker} className="border-t border-white/[0.08] py-[18px] first:border-t-0 first:pt-0">
                <div className="mb-[9px] flex items-center gap-[10px]">
                  <span className="h-[2px] w-[18px] flex-none rounded-full" style={{ background: accent }} />
                  <span className="font-mono text-[10.5px] font-bold tracking-[.2em]" style={{ color: accent }}>
                    {law.kicker}
                  </span>
                </div>
                <p className="font-display m-0 text-[18px] font-extrabold leading-tight text-ink">{law.lead}</p>
                <p className="m-0 mt-[6px] text-[14px] leading-[1.55] text-ink-faint">{law.body}</p>
              </div>
            );
          })}
        </div>

        {/* what feeds the six — a compact readout that echoes the card's stat block */}
        <div className="mt-[24px] border-t border-white/[0.08] pt-[20px]">
          <div className="font-mono mb-[14px] text-[10.5px] font-bold tracking-[.2em] text-ink-faint">
            WHAT FEEDS THE SIX
          </div>
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[13px] max-[440px]:grid-cols-1">
            {READS.map((r) => (
              <div key={r.abbr} className="flex items-start gap-[11px]">
                <span className="font-display mt-[1px] w-[42px] flex-none rounded-[7px] bg-brand/15 py-[5px] text-center text-[13px] font-extrabold tracking-[.04em] text-brand">
                  {r.abbr}
                </span>
                <span className="text-[13px] leading-[1.4] text-ink-faint">{r.gloss}</span>
              </div>
            ))}
          </div>
        </div>

        {/* the ladder — what you're chasing, low to legend */}
        <div className="mt-[24px] border-t border-white/[0.08] pt-[20px]">
          <div className="font-mono mb-[13px] text-[10.5px] font-bold tracking-[.2em] text-ink-faint">THE LADDER</div>
          <div className="flex flex-wrap items-center gap-y-[8px]">
            {LADDER.map((f, i) => (
              <span key={f.label} className="inline-flex items-center">
                <span
                  className="font-display rounded-[7px] px-[11px] py-[5px] text-[12.5px] font-bold tracking-[.06em]"
                  style={{ background: f.bg, color: f.ink }}
                >
                  {f.label}
                </span>
                {i < LADDER.length - 1 && (
                  <span aria-hidden className="px-[7px] text-[11px] text-ink-mute">
                    →
                  </span>
                )}
              </span>
            ))}
          </div>
          <p className="m-0 mt-[16px] text-[12px] leading-[1.5] text-ink-mute">
            Read live from your public GitHub via the GraphQL API. No inputs, no edits — just the tape.
          </p>
        </div>
      </div>
    </div>
  );
}
