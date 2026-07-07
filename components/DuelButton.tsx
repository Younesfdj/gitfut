"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The duel entry — "the fixture plate". A pure CTA on the neutral chrome the
// icon buttons wear (so it sits on every tier-tinted page without clashing);
// the duel's identity lives in a small GOLD VS mark — the design system's
// reserved prestige metal, because a duel is a prestige fixture. On hover the
// label rolls up like a stadium scoreboard to tease the fixture (@you VS ???);
// clicking slides the opponent input open BELOW the plate — the button never
// morphs into a form. Purely typographic: no icon-pack glyphs.

export default function DuelButton({ login }: { login: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const plateRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // select() (which also focuses) so a stale draft from a previous open is
  // replaced by typing instead of resurrecting mid-word.
  useEffect(() => {
    if (open) inputRef.current?.select();
  }, [open]);

  // Click-away closes via pointerdown-outside — NOT a blur heuristic: Safari
  // buttons never take focus on tap, so an input-blur check can fire with
  // activeElement=body between the blur and the KICK OFF click, unmount the
  // form and swallow the submit (same WebKit trap CardActions documents).
  // pointerdown fires before blur/click everywhere, so it can't race.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const away = opponent.trim().replace(/^@/, "");
    if (!away || isPending) return;
    startTransition(() =>
      router.push(
        `/${encodeURIComponent(login)}/vs/${encodeURIComponent(away)}`,
      ),
    );
  };

  // Keyboard tab-out collapses the row. Deferred so the new focus target is
  // committed; only a REAL element outside closes it — activeElement=body is
  // exactly the ambiguous Safari mid-tap state pointerdown already covers.
  const onBlurAway = () => {
    if (isPending) return;
    setTimeout(() => {
      const ae = document.activeElement;
      if (ae && ae !== document.body && !wrapRef.current?.contains(ae)) {
        setOpen(false);
      }
    }, 0);
  };

  // One roll window: both lines stack inside a clipped 50px viewport and the
  // stack slides up one line on hover/focus/open — the scoreboard flip.
  // 44px = the plate's 46px border-box minus its 1px borders, so one line is
  // exactly one -100% roll step
  const line =
    "flex h-[44px] items-center justify-center gap-[10px] px-[46px] transition-transform duration-[350ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none";
  const rolled = (o: boolean) =>
    o
      ? "-translate-y-full"
      : "group-hover:-translate-y-full group-focus-visible:-translate-y-full";

  return (
    <div ref={wrapRef} onBlur={onBlurAway} className="flex w-full flex-col gap-[8px]">
      <button
        ref={plateRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? "duel-kickoff" : undefined}
        title="Challenge someone to a duel"
        className="group relative h-[46px] w-full overflow-hidden rounded-xl border border-line bg-white/[0.03] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-gold/55 hover:shadow-[0_10px_26px_-12px_rgba(212,175,55,.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:translate-y-0 active:scale-[.985]"
      >
        {/* the pitch: halfway line, centre circle, kickoff dot */}
        <svg
          aria-hidden
          viewBox="0 0 200 60"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
        >
          <line x1="100" y1="0" x2="100" y2="60" stroke="#e9cc74" strokeWidth="1" />
          <circle cx="100" cy="30" r="22" fill="none" stroke="#e9cc74" strokeWidth="1" />
          <circle
            cx="100"
            cy="30"
            r="2.5"
            fill="#e9cc74"
            className="motion-safe:group-hover:animate-[ball-pulse_.9s_ease-in-out_infinite]"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        </svg>

        {/* a floodlight sheen crossing the plate every ~7s — faint on purpose */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-gold/[0.09] to-transparent motion-safe:animate-[duel-sweep_7s_ease-in-out_infinite]"
        />

        {/* the scoreboard roll window */}
        <span className="relative block h-full overflow-hidden">
          <span className={`${line} ${rolled(open)}`}>
            <span className="font-display text-[19px] tracking-[.1em] text-ink">
              DUEL A RIVAL
            </span>
            <span className="font-display text-[15px] tracking-[.08em] text-gold-hi">
              VS
            </span>
          </span>
          <span aria-hidden className={`${line} ${rolled(open)}`}>
            <span className="font-display min-w-0 truncate text-[19px] tracking-[.1em] text-ink">
              @{login.toUpperCase()}
            </span>
            <span className="font-display shrink-0 text-[15px] tracking-[.08em] text-gold-hi">
              VS
            </span>
            <span className="font-display shrink-0 text-[19px] tracking-[.1em] text-gold-hi">
              ???
            </span>
          </span>
        </span>
      </button>

      {/* the team sheet: slides open below, the plate above stays a button */}
      {open && (
        <form
          id="duel-kickoff"
          onSubmit={submit}
          aria-busy={isPending}
          className="animate-pop flex h-[46px] w-full items-center gap-[8px] rounded-xl border border-line bg-white/[0.03] px-[6px]"
        >
          {/* 16px ONLY on small-screen touch devices (stops iOS Safari's focus
              auto-zoom); touch laptops and desktops keep the quiet 13.5 */}
          <input
            ref={inputRef}
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            onKeyDown={(e) => {
              // restore focus to the plate so Escape doesn't dump keyboard
              // users at the top of the tab order; never mid-submit
              if (e.key === "Escape" && !isPending) {
                setOpen(false);
                plateRef.current?.focus();
              }
            }}
            placeholder="their username"
            autoComplete="off"
            spellCheck={false}
            readOnly={isPending}
            aria-label="Opponent's GitHub username"
            className="font-mono h-[34px] w-full min-w-0 flex-1 rounded-[8px] border border-line bg-bg/80 px-[10px] text-[13.5px] text-white outline-none transition placeholder:text-ink-faint focus:border-gold/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,.14)] max-lg:pointer-coarse:text-[16px]"
          />
          <button
            type="submit"
            disabled={isPending || !opponent.trim()}
            aria-label="Kick off the duel"
            className="font-display flex h-[34px] min-w-[94px] shrink-0 items-center justify-center gap-[7px] rounded-[8px] border border-gold/45 bg-gold/10 px-[13px] text-[14.5px] tracking-[.07em] text-gold-hi transition hover:bg-gold/20 hover:text-[#f7e6b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-gold/10"
          >
            {isPending ? (
              <span className="h-[13px] w-[13px] animate-spin rounded-full border-[1.5px] border-gold/30 border-t-gold-hi" />
            ) : (
              <>
                KICK OFF
                <span aria-hidden className="text-[15px] leading-none">
                  →
                </span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
