"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/scoring/types";
import { qualifyingStat, type Award } from "@/lib/awards";
import TrophySprite from "./TrophySprite";

// Trophy details dialog, shared by the profile shelf and duel corners. Follows
// the HowItWorksModal conventions: dialog semantics, focus on open, Escape and
// backdrop close, entrance transition (instant under reduced motion via the
// global reset).
export default function AwardModal({
  award,
  card,
  onClose,
}: {
  award: Award;
  card: Card;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

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
        aria-labelledby="award-title"
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-[min(520px,100%)] flex-col items-center gap-4 rounded-[20px] border border-line bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-panel))] p-6 shadow-[0_40px_120px_rgba(0,0,0,.6)] outline-none sm:flex-row sm:gap-6"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0) scale(1)" : "translateY(14px) scale(.985)",
          transition: "opacity .4s ease, transform .45s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[15px] text-ink-faint transition hover:bg-white/10 hover:text-ink"
        >
          ✕
        </button>

        <div className="flex flex-none items-center justify-center">
          <TrophySprite sprite={award.key} size={140} className="animate-float" />
        </div>

        <div className="flex flex-1 flex-col gap-2 text-center sm:text-left">
          <h3
            id="award-title"
            className="font-display text-2xl font-black uppercase leading-tight tracking-wide text-gold-hi"
          >
            {award.title}
          </h3>

          <div>
            <span className="inline-block rounded-full border border-brand/20 bg-brand/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand">
              {award.metricLabel}
            </span>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{award.description}</p>

          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3 font-mono text-[11px] text-ink-mute">
            <span>QUALIFYING STAT</span>
            <span className="text-xs font-bold text-ink-dim">{qualifyingStat(award, card)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
