"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WHATS_NEW } from "@/config/whatsNew";

const SEEN_KEY = "gitfut:team-news:seen";

// Static config → filter once at module scope. If nothing is on show the
// component renders nothing at all.
const ITEMS = WHATS_NEW.filter((i) => i.show);

function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(SEEN_KEY) ?? "[]",
    );
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
  const [shown, setShown] = useState(false); // entrance transition flag
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
    try {
      const seen = new Set([...readSeen(), ...ITEMS.map((i) => i.id)]);
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {}
    setOpen(false);
    setShown(false);
    returnFocusRef.current?.focus();
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
      onClick={dismiss}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-deep/70 p-[22px] backdrop-blur-[5px] max-[560px]:items-end max-[560px]:p-0"
      style={{ opacity: shown ? 1 : 0, transition: "opacity .25s ease" }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-news-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[86vh] w-[min(430px,100%)] overflow-auto rounded-[20px] border border-line bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-panel))] p-[clamp(22px,4.5vw,30px)] shadow-[0_40px_120px_rgba(0,0,0,.65)] outline-none max-[560px]:w-full max-[560px]:rounded-b-none max-[560px]:pb-[max(22px,env(safe-area-inset-bottom))]"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown
            ? "translateY(0) scale(1)"
            : "translateY(16px) scale(.985)",
          transition:
            "opacity .35s ease, transform .4s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* brand hairline bleeding in along the top edge — house style */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(57,211,83,.55), transparent)",
          }}
        />

        <div className="flex justify-between">
          <div>
            <h2
              id="team-news-title"
              className="font-display m-0 text-[clamp(30px,5vw,38px)] font-black leading-[.95] tracking-[-.01em]"
            >
              TEAM NEWS<span className="text-brand">.</span>
            </h2>
            <p className="m-0 mt-[8px] text-[13.5px] leading-[1.5] text-ink-dim">
              {count === 1 ? "One change" : `${count} changes`} in this window.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[15px] text-ink-faint transition hover:bg-white/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            ✕
          </button>
        </div>

        {/* the changes — each one comes ON like a substitution */}
        <ul className="list-none p-0">
          {ITEMS.map((item) => (
            <li
              key={item.id}
              className="flex gap-[13px] border-t border-white/[0.08] py-[15px] first:border-t-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="flex items-center p-0">
                  <h3 className="font-display m-0 text-[20px] font-extrabold leading-tight tracking-[.03em] text-ink">
                    {item.title}
                  </h3>
                  {item.icon && (
                    <div className="">
                      {typeof item.icon === "function" ? (
                        <item.icon size={50} />
                      ) : (
                        item.icon
                      )}
                    </div>
                  )}
                </div>
                <p className="m-0 text-[14px] leading-[1.55] text-ink-faint">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={dismiss}
          className="font-display mt-[20px] flex h-[44px] w-full items-center justify-center rounded-xl border border-line bg-white/[0.03] text-[16px] tracking-[.1em] text-ink transition hover:border-brand/50 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          GOT IT
        </button>
      </div>
    </div>
  );
}
