"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WHATS_NEW } from "@/config/whatsNew";

const SEEN_KEY = "gitfut:team-news:seen";

// Static config → filter once at module scope. If nothing is on show the
// component renders nothing at all.
const ITEMS = WHATS_NEW.filter((i) => i.show);

function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export default function WhatsNew() {
  // ITEMS is a module constant, so this early return is stable across renders.
  if (ITEMS.length === 0) return null;
  return <TeamNews />;
}

function TeamNews() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // entrance/exit transition flag
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  // Whether the pointer press that may end in a backdrop "click" actually
  // started on the backdrop — so text selected inside the panel and released
  // over the backdrop doesn't count as a dismiss.
  const pressedBackdrop = useRef(false);

  // Decide visibility after mount — sessionStorage isn't readable during SSR,
  // and starting hidden means a dismissed session never sees a flash. The
  // short hold also keeps the bulletin from fighting the hero's entrance.
  useEffect(() => {
    const seen = readSeen();
    if (!ITEMS.some((i) => !seen.includes(i.id))) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    try {
      const seen = new Set([...readSeen(), ...ITEMS.map((i) => i.id)]);
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {}
    setShown(false); // play the exit, then unmount a beat later
    setTimeout(() => {
      setOpen(false);
      returnFocusRef.current?.focus();
    }, 200);
  }, []);

  // While open: focus moves into the dialog (and back on close), Escape
  // dismisses, Tab is trapped inside, and the page behind can't scroll.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => setShown(true), 10);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, dismiss]);

  if (!open) return null;

  const count = ITEMS.length;

  return (
    <div
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedBackdrop.current) dismiss();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-deep/70 p-[22px] backdrop-blur-[5px] max-[560px]:items-end max-[560px]:p-0"
      style={{ opacity: shown ? 1 : 0, transition: "opacity .25s ease" }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-news-title"
        className="relative max-h-[86vh] w-[min(428px,100%)] overflow-y-auto overflow-x-hidden rounded-[20px] border border-line bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-panel))] p-[clamp(24px,4.5vw,30px)] shadow-[0_40px_120px_rgba(0,0,0,.65)] outline-none max-[560px]:w-full max-[560px]:rounded-b-none max-[560px]:pb-[max(24px,env(safe-area-inset-bottom))]"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown
            ? "translateY(0) scale(1)"
            : "translateY(16px) scale(.985)",
          transition: "opacity .35s ease, transform .4s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* a top-down pitch stretched to fill the panel — the site's football
            DNA as a full-bleed watermark, so the whole court reads (nothing
            cropped) and it sits faint under the copy. Content below is wrapped
            in a positioned layer so it paints ABOVE this (an absolute SVG would
            otherwise paint over static in-flow text). */}
        <svg
          aria-hidden
          viewBox="0 0 300 210"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        >
          <g fill="none" stroke="#39d353" strokeWidth="1.3">
            <rect x="9" y="9" width="282" height="192" rx="2" />
            <line x1="150" y1="9" x2="150" y2="201" />
            <circle cx="150" cy="105" r="30" />
            {/* left goal */}
            <rect x="9" y="61" width="40" height="88" />
            <rect x="9" y="84" width="15" height="42" />
            <path d="M49 83 A 25 25 0 0 1 49 127" />
            {/* right goal */}
            <rect x="251" y="61" width="40" height="88" />
            <rect x="276" y="84" width="15" height="42" />
            <path d="M251 83 A 25 25 0 0 0 251 127" />
          </g>
          <g fill="#39d353">
            <circle cx="150" cy="105" r="2.4" />
            <circle cx="37" cy="105" r="1.5" />
            <circle cx="263" cy="105" r="1.5" />
          </g>
        </svg>

        {/* brand hairline bleeding in along the top edge — house style */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(57,211,83,.55), transparent)",
          }}
        />

        <div className="relative z-[1]">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="team-news-title"
              className="font-display text-[clamp(32px,5vw,40px)] font-black leading-[.88] tracking-[-.01em]"
            >
              TEAM NEWS<span className="text-brand">.</span>
            </h2>
            <button
              onClick={dismiss}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[17px] text-ink-mute transition hover:bg-white/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <span aria-hidden>×</span>
            </button>
          </div>

          <p className="mt-[10px] text-[13.5px] leading-[1.5] text-ink-soft">
            {count === 1 ? "One new feature." : `${count} new features.`}
          </p>

          <ul className="mt-[22px] list-none p-0">
            {ITEMS.map((item) => (
              <li
                key={item.id}
                className="border-t border-line/70 py-[18px] first:border-t-0 first:pt-0 last:pb-0"
              >
                <h3 className="font-display text-[21px] font-extrabold leading-[1] tracking-[.02em] text-ink">
                  {item.title}
                </h3>
                <p className="mt-[8px] text-[14px] leading-[1.55] text-ink-soft">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>

          <button
            onClick={dismiss}
            className="font-display mt-[24px] flex h-[46px] w-full items-center justify-center rounded-xl border border-line bg-white/[0.03] text-[16px] tracking-[.14em] text-ink transition hover:-translate-y-px hover:border-brand/55 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 active:translate-y-0"
          >
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
