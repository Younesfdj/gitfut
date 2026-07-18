"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import Mascot from "./Mascot";

interface Props {
  loading: boolean;
  error: string | null;
  scoutCount: number | null;
  onScout: (name: string) => void;
  onOpenModal: () => void;
}

const exampleClass =
  "cursor-pointer font-mono text-ink-soft underline decoration-brand/40 underline-offset-[3px] transition hover:text-brand";

// Stagger-in wrapper: each child fades + lifts with a cascade delay.
function Stagger({
  step,
  children,
  className,
}: {
  step: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const t = setTimeout(() => setShown(true), reduced ? 0 : 80 + step * 120);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0) scale(1)" : "translateY(16px) scale(.97)",
        transition:
          "opacity .6s ease, transform .65s cubic-bezier(.16,1,.3,1)",
      }}
    >
      {children}
    </div>
  );
}

export default function ScoutForm({
  loading,
  error,
  scoutCount,
  onScout,
  onOpenModal,
}: Props) {
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const hasText = name.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onScout(name);
  };

  return (
    <div className="min-w-0 flex-1">
      {/* mascot — the brand face on the hero */}
      <Stagger step={0}>
        <div className="mb-1 -ml-2 max-[860px]:mx-auto max-[860px]:flex max-[860px]:justify-center">
          <Mascot size={150} />
        </div>
      </Stagger>

      {/* crossover "fixture" tag — the dev world (mono GITHUB) versus the
          tournament (broadcast WORLD CUP 26), joined by the × the concept implies.
          No status-pill or pulsing dot — the type carries it. */}
      <Stagger step={1}>
        <div className="mb-[18px] inline-flex items-center gap-[9px] rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-[12px] py-[6px] max-[860px]:mx-auto">
          <span className="font-mono text-[10.5px] font-semibold tracking-[.18em] text-ink-soft">
            GITHUB
          </span>
          <span className="font-display text-[15px] mt-[1px] leading-none text-brand">
            ×
          </span>
          <span className="font-display text-[15px] leading-none tracking-[.06em] text-ink">
            WORLD CUP <span className="text-gold-hi">26</span>
          </span>
        </div>
      </Stagger>

      {/* hero headline — gradient shimmer sweeps across on load */}
      <Stagger step={2}>
        <h1
          className="font-display m-0 mb-3 text-[clamp(52px,7vw,104px)] leading-[.82] tracking-[.005em]"
          style={{
            backgroundImage:
              "linear-gradient(100deg, #e6edf3 0%, #e6edf3 35%, #39d353 48%, #56e06b 52%, #fff 55%, #e6edf3 65%, #e6edf3 100%)",
            backgroundSize: "220% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animation: "hero-shimmer 2.8s ease-in-out 0.9s both",
          }}
        >
          GET SCOUTED<span style={{ color: "#39d353" }}>.</span>
        </h1>
      </Stagger>

      <Stagger step={3}>
        <p className="mb-[26px] max-w-[420px] text-[clamp(15px,1.7vw,18px)] font-medium leading-[1.5] text-ink-dim max-[860px]:mx-auto">
          Your GitHub stats, turned into a World-Cup-style player card rated out
          of 99.
        </p>
      </Stagger>

      <Stagger step={4}>
        <form
          onSubmit={submit}
          className="m-0 flex max-w-[460px] flex-wrap gap-[10px] max-[860px]:mx-auto"
        >
          {/* input with animated gradient border on focus */}
          <div className="relative min-w-[200px] flex-1">
            {/* animated border glow — sits behind the input, visible on focus */}
            <div
              className="pointer-events-none absolute -inset-[1.5px] rounded-[15px] transition-opacity duration-300"
              style={{
                opacity: focused ? 1 : 0,
                background:
                  "linear-gradient(135deg, #39d353, #26a641, #56e06b, #39d353, #006d32, #39d353)",
                backgroundSize: "300% 300%",
                animation: focused ? "gradient-border 4s ease infinite" : "none",
              }}
            />
            <div className="relative">
              <span className="font-mono pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[17px] font-semibold transition-colors duration-200" style={{ color: focused ? "#39d353" : "rgba(57,211,83,0.4)" }}>@</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="github username"
                autoComplete="off"
                spellCheck={false}
                aria-label="GitHub username"
                className="font-mono relative h-14 w-full rounded-[14px] border-[1.5px] border-transparent bg-surface/90 pl-[34px] pr-5 text-[16px] font-medium text-white outline-none backdrop-blur-[4px] transition-all duration-200 focus:bg-surface focus:shadow-[0_0_42px_rgba(57,211,83,.18)]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`font-display group flex h-14 items-center gap-2 rounded-[14px] bg-gradient-to-b from-brand to-brand-mid px-7 text-[20px] tracking-[.06em] text-[#04130a] shadow-[0_0_0_1px_rgba(57,211,83,.4),0_10px_30px_rgba(57,211,83,.3)] transition-all duration-200 hover:from-brand-hi hover:to-brand disabled:cursor-wait disabled:opacity-75 ${
              hasText && !loading
                ? "shadow-[0_0_0_1px_rgba(57,211,83,.5),0_10px_36px_rgba(57,211,83,.45)] scale-[1.02]"
                : ""
            }`}
          >
            {loading ? "SCOUTING…" : "SCOUT"}
            {!loading && (
              <ArrowRight
                size={19}
                strokeWidth={2.6}
                className="transition-transform group-hover:translate-x-0.5"
              />
            )}
          </button>
        </form>
      </Stagger>

      {error && (
        <div
          role="alert"
          className="mt-[13px] max-w-[460px] rounded-[10px] border border-[#f85149]/30 bg-[#f85149]/10 px-[13px] py-[10px] text-[13.5px] font-medium text-[#ff9d96]"
        >
          {error}
        </div>
      )}

      <Stagger step={5}>
        <div className="mt-[14px] text-[13px] text-ink-mute">
          try{" "}
          <button
            type="button"
            onClick={() => onScout("torvalds")}
            className={exampleClass}
          >
            torvalds
          </button>{" "}
          ·{" "}
          <button
            type="button"
            onClick={() => onScout("sindresorhus")}
            className={exampleClass}
          >
            sindresorhus
          </button>{" "}
          · or your own
        </div>
      </Stagger>

      {/* live tally — scoreboard LED chip: the number is the social proof, so
          it leads in the display face with tabular figures, wrapped in a slim
          inset-shadow panel that reads like a stadium scoreboard digit. */}
      <Stagger step={6}>
        <div className="mt-[20px] flex flex-wrap items-center gap-x-[14px] gap-y-[10px] max-[860px]:justify-center">
          {scoutCount != null && (
            <>
              <span className="inline-flex items-center gap-[9px] rounded-[10px] border border-white/[0.08] bg-white/[0.02] px-[12px] py-[7px] shadow-[inset_0_1px_3px_rgba(0,0,0,.4)]">
                <span className="relative flex h-[7px] w-[7px] translate-y-[-1px] self-center" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-brand" />
                </span>
                <span className="font-display text-[20px] leading-none tabular-nums text-ink">
                  {scoutCount.toLocaleString("en-US")}
                </span>
                <span className="text-[12px] text-ink-mute">cards rated</span>
              </span>
              <span aria-hidden className="h-[12px] w-px bg-white/[0.12] max-[860px]:hidden" />
            </>
          )}
          <button
            type="button"
            onClick={onOpenModal}
            className="cursor-pointer text-[12.5px] font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline"
          >
            how it works ↗
          </button>
        </div>
      </Stagger>
    </div>
  );
}
