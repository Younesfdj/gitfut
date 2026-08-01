"use client";

import { useEffect, useRef, useState } from "react";
import type { AwardInstance, AwardKey } from "@/lib/scoring/types";
import { AWARD_META } from "@/lib/awards";
import TrophySprite, { AWARD_SPRITES } from "./TrophySprite";

// Trophy details dialog, shared by the profile shelf and duel corners. Shows
// every instance of the award the card holds — a 3× Ballon d'Or lists all
// three years with their reasons. Follows the HowItWorksModal conventions:
// dialog semantics, focus on open, Escape and backdrop close, entrance
// transition (instant under reduced motion via the global reset).
export default function AwardModal({
  awardKey,
  instances,
  onClose,
}: {
  awardKey: AwardKey;
  instances: AwardInstance[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const meta = AWARD_META[awardKey];
  const art = AWARD_SPRITES[awardKey];

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
        className="relative flex max-h-[85vh] w-[min(560px,100%)] flex-col items-center gap-4 overflow-auto rounded-[20px] border border-line bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-panel))] p-6 shadow-[0_40px_120px_rgba(0,0,0,.6)] outline-none sm:flex-row sm:items-start sm:gap-6"
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

        <div className="relative flex flex-none flex-col items-center sm:sticky sm:top-0">
          <TrophySprite sprite={art.sprite} size={140} className={`animate-float ${art.tint ?? ""}`} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 text-center sm:text-left">
          <h3
            id="award-title"
            className="font-display text-2xl font-black uppercase leading-tight tracking-wide text-gold-hi"
          >
            {meta.title}
          </h3>

          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{meta.description}</p>

          <ul className="mt-3 flex flex-col gap-2 border-t border-white/5 pt-3">
            {instances.map((a) => (
              <li key={`${a.year ?? ""}${a.edition ?? "held"}`} className="text-left">
                <span className="font-display mr-2 text-[12px] font-bold tracking-[.14em] text-gold">
                  {a.edition ?? a.year ?? "CURRENT FORM"}
                </span>
                <span className="text-[12.5px] leading-snug text-ink-dim">{a.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
