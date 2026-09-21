"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ResultView from "@/components/ResultView";
import BallCursor from "@/components/BallCursor";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import { BALL_MQ, TOUR_STEPS, TOUR_STORAGE_KEY, type TourStep } from "./steps";

// The first-visit what's-new tour: a dark thank-you screen over a fully mounted
// demo scout page (the baked torvalds sample — zero fetch), then a camera that
// dives from stop to stop. The camera is a translate+scale on the stage; the
// spotlight is a rounded hole cut with a huge box-shadow that rides INSIDE the
// stage, so hole and content zoom as one. Home stays mounted under the overlay
// the whole time — entry and exit are mount/unmount, no navigation.
//
// Rhythm (the Screen Studio feel): the page is shown whole first, the camera
// dives slowly, and between stops it pulls all the way back and breathes before
// diving again — so a viewer never loses where they are. Nothing auto-advances.

const EASE = "cubic-bezier(.16,1,.3,1)";
const ZOOM_IN_MS = 1500; // the slow dive
const ZOOM_OUT_MS = 900; // the pull back to the whole page
const OPEN_HOLD = 1500; // look at the scout page before the first dive
const WIDE_HOLD = 1000; // breathe at full view between stops
const EXIT_MS = 380;
const HOME_HOLD = 850; // home is seen plainly first, then the dark washes over it
const ENTER_MS = 550; // that wash
const CAP_GAP = 14; // caption sits close to the spotlight, part of the same beat

interface Cam {
  s: number;
  tx: number;
  ty: number;
}
const IDENTITY: Cam = { s: 1, tx: 0, ty: 0 };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Caption {
  step: TourStep;
  /** Viewport-space placement, computed when the dive is fired. */
  style: { left: number; top?: number; bottom?: number };
  /** Camera travel time — the caption fades in as it lands. */
  landMs: number;
}

// "Thank you" around the world. Same words, one shared grid cell, so the block
// never changes width as it cycles. Non-latin scripts get a clean system stack
// (no webfont downloads — these ship with every OS we care about).
const THANKS: readonly { lang: string; text: string; font?: string; rtl?: boolean }[] = [
  { lang: "en", text: "Thank you!" },
  { lang: "fr", text: "Merci!" },
  { lang: "es", text: "Gracias" },
  {
    lang: "ar",
    text: "شكرًا",
    font: '"Noto Naskh Arabic","SF Arabic","Geeza Pro","Segoe UI",Tahoma,serif',
    rtl: true,
  },
  { lang: "de", text: "Danke!" },
  { lang: "ko", text: "감사합니다", font: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif' },
  { lang: "ja", text: "ありがとう", font: '"Hiragino Sans","Yu Gothic","Noto Sans JP",Meiryo,sans-serif' },
];
const THANKS_MS = 3000;
// The counters land at ~2s. The way into the tour surfaces as they settle, so
// the thank-you is read before there is anywhere to click.
const CTA_DELAY = 2000;

// `gold` marks the milestone figure — the one number on this screen that gets
// the prestige colour instead of plain ink.
const STATS = [
  { to: 160, prefix: "+", suffix: "k", label: "VISITORS" },
  { to: 1, prefix: "+", suffix: "M", label: "CARDS GENERATED", delay: 220, gold: true },
  { to: 2.5, decimals: 1, suffix: "k", label: "GITHUB STARS", delay: 440 },
];

const demoCard = () => SAMPLE_CARDS.find((c) => c.login === "torvalds") ?? SAMPLE_CARDS[0];

const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Eased count-up; renders the target outright under reduced motion. `run`
// holds it at zero until the screen is actually visible, so the climb isn't
// spent behind the fade.
function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  delay = 0,
  run,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  run: boolean;
}) {
  const [reduced] = useState(prefersReduced);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced || !run) return;
    let raf = 0;
    let start = 0;
    const DUR = 1600;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start - delay) / DUR, 1);
      if (p >= 0) setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, reduced, run]);
  return (
    <span className="tabular-nums">
      {prefix}
      {(reduced ? to : v).toFixed(decimals)}
      {suffix}
    </span>
  );
}

export default function FeatureTour({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"intro" | "tour" | "exit">("intro");
  const [idx, setIdx] = useState(0);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [thanksIdx, setThanksIdx] = useState(0);
  const [ctaIn, setCtaIn] = useState(false);
  const [shown, setShown] = useState(false);
  // Resolved once on mount (ssr:false, so window exists): drop the ball stop
  // where the ball itself never mounts, and flatten motion when asked to.
  const [steps] = useState<readonly TourStep[]>(() =>
    window.matchMedia(BALL_MQ).matches ? TOUR_STEPS : TOUR_STEPS.filter((s) => s.key !== "ball"),
  );
  const [reduced] = useState(prefersReduced);

  const stageRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Cam>(IDENTITY);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, String(Date.now()));
    } catch {}
    clearTimers();
    setPhase("exit");
    setTimeout(onDone, EXIT_MS + 30);
  }, [onDone]);

  // Let home stand on its own for a beat, then wash over it. Everything else
  // in the intro is timed off `shown`, not off mount, so the count-up and the
  // CTA still land against the moment a visitor can actually see them.
  useEffect(() => {
    const t = setTimeout(() => setShown(true), HOME_HOLD);
    return () => clearTimeout(t);
  }, []);

  // Cycle the thank-you through its languages while the intro is up.
  useEffect(() => {
    if (phase !== "intro" || !shown || reduced) return;
    const id = setInterval(() => setThanksIdx((i) => (i + 1) % THANKS.length), THANKS_MS);
    return () => clearInterval(id);
  }, [phase, shown, reduced]);

  // Hold the way in back until the thank-you has had its moment. It stays in
  // the layout the whole time (only opacity moves), so nothing shifts when it
  // arrives.
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setCtaIn(true), CTA_DELAY);
    return () => clearTimeout(t);
  }, [shown]);

  useEffect(() => clearTimers, []);

  // ---- camera ---------------------------------------------------------------

  // Document-space rect of a stage target, valid under any current transform
  // (getBoundingClientRect includes the camera, so divide it back out).
  const measure = useCallback((target: string): Rect | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const els = Array.from(stage.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
    const el = els.find((e) => e.getClientRects().length > 0) ?? els[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const { s, tx, ty } = camRef.current;
    return { x: (r.left - tx) / s, y: (r.top - ty) / s, w: r.width / s, h: r.height / s };
  }, []);

  // Move the camera; `hole` frames the spotlight, omitting it fades the veil
  // away (the wide, undimmed view between stops).
  const applyCam = useCallback(
    (cam: Cam, ms: number, hole?: Rect) => {
      const stage = stageRef.current;
      const holeEl = holeRef.current;
      if (!stage) return;
      const dur = reduced ? 0 : ms;
      stage.style.transition = `transform ${dur}ms ${EASE}`;
      stage.style.transform = `translate3d(${cam.tx}px, ${cam.ty}px, 0) scale(${cam.s})`;
      camRef.current = cam;
      if (!holeEl) return;
      holeEl.style.transition = `left ${dur}ms ${EASE}, top ${dur}ms ${EASE}, width ${dur}ms ${EASE}, height ${dur}ms ${EASE}, opacity ${dur}ms ${EASE}`;
      if (hole) {
        holeEl.style.left = `${hole.x}px`;
        holeEl.style.top = `${hole.y}px`;
        holeEl.style.width = `${hole.w}px`;
        holeEl.style.height = `${hole.h}px`;
        holeEl.style.opacity = "1";
      } else {
        holeEl.style.opacity = "0";
      }
    },
    [reduced],
  );

  // Frame a stop into ~60% of the viewport, capped per step so small targets
  // (the ball) zoom harder without pixelating into absurdity; land it slightly
  // above center so the caption breathes below.
  const camFor = useCallback((rect: Rect, step: TourStep): Cam => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(
      Math.max(Math.min((vw * 0.6) / (rect.w + step.pad * 2), (vh * 0.56) / (rect.h + step.pad * 2)), 1.12),
      step.maxScale,
    );
    return { s, tx: vw / 2 - (rect.x + rect.w / 2) * s, ty: vh * 0.44 - (rect.y + rect.h / 2) * s };
  }, []);

  // Caption hugs the spotlight: under it when there's room, above it otherwise
  // (the ball sits at the very bottom).
  const captionPos = (pad: Rect, cam: Cam): Caption["style"] => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = pad.y * cam.s + cam.ty;
    const bottom = (pad.y + pad.h) * cam.s + cam.ty;
    const cx = (pad.x + pad.w / 2) * cam.s + cam.tx;
    // Clamp by the pill's real half-width so it stays fully on-screen on phones.
    const half = Math.min(470, vw * 0.88) / 2 + 8;
    const left = Math.min(Math.max(cx, half), vw - half);
    return bottom + 190 < vh ? { left, top: bottom + CAP_GAP } : { left, bottom: vh - top + CAP_GAP };
  };

  const dive = useCallback(
    (step: TourStep) => {
      const rect = measure(step.target);
      if (!rect) return finish(); // target missing: bail out gracefully
      const pad: Rect = {
        x: rect.x - step.pad,
        y: rect.y - step.pad,
        w: rect.w + step.pad * 2,
        h: rect.h + step.pad * 2,
      };
      const cam = camFor(rect, step);
      applyCam(cam, ZOOM_IN_MS, pad);
      setCaption({ step, style: captionPos(pad, cam), landMs: reduced ? 0 : ZOOM_IN_MS });
    },
    [measure, camFor, applyCam, finish, reduced],
  );

  // Travel to a stop: pull back to the whole page, breathe, then dive.
  const goTo = useCallback(
    (i: number, openDelay = 0) => {
      const step = steps[i];
      if (!step) return finish();
      clearTimers();
      setIdx(i);
      setCaption(null);
      const zoomed = camRef.current.s > 1.001;
      if (zoomed && !reduced) applyCam(IDENTITY, ZOOM_OUT_MS);
      const wait = reduced ? 0 : zoomed ? ZOOM_OUT_MS + WIDE_HOLD : openDelay;
      after(wait, () => dive(step));
    },
    [steps, applyCam, dive, finish, reduced],
  );

  const start = () => {
    setPhase("tour");
    goTo(0, OPEN_HOLD);
  };

  // No Escape hatch on purpose: the tour is a once-ever thing, and it is only
  // marked seen when someone actually walks it (finish or skip). A stray
  // keypress or a reload must not burn it — it comes back next visit instead.

  // Mid-tour resize: reframe the current stop quickly, no ceremony.
  useEffect(() => {
    if (phase !== "tour") return;
    const onResize = () => {
      const step = steps[idx];
      if (!step || camRef.current.s <= 1.001) return;
      const rect = measure(step.target);
      if (!rect) return;
      const pad: Rect = { x: rect.x - step.pad, y: rect.y - step.pad, w: rect.w + step.pad * 2, h: rect.h + step.pad * 2 };
      const cam = camFor(rect, step);
      applyCam(cam, 180, pad);
      setCaption({ step, style: captionPos(pad, cam), landMs: 180 });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [phase, idx, steps, measure, applyCam, camFor]);

  const last = idx + 1 >= steps.length;

  return (
    <div
      className="fixed inset-0 z-[110] overflow-hidden bg-bg"
      style={{
        opacity: shown && phase !== "exit" ? 1 : 0,
        // nothing invisible should eat a click on home during the hold
        pointerEvents: shown ? "auto" : "none",
        transition: reduced ? "none" : `opacity ${phase === "exit" ? EXIT_MS : ENTER_MS}ms ${EASE}`,
      }}
    >
      {/* ---- the demo stage: a real, live scout page under the camera ---- */}
      <div
        ref={stageRef}
        className="pointer-events-none absolute inset-0 origin-top-left will-change-transform"
        aria-hidden
      >
        <ResultView card={demoCard()} onBack={() => {}} onCountryChange={() => {}} stars={null} demo />
        {/* fixed-position children anchor to this transformed stage, so this
            ball lives in the stage's corner and zooms with the camera (the
            layout's global ball sits beneath the overlay, unseen) */}
        <BallCursor />
        {/* spotlight: transparent hole + a world of darkness around it. The z
            must clear everything in the stage (main is z-[2]) or the veil
            dims nothing. */}
        <div
          ref={holeRef}
          className="absolute rounded-2xl"
          style={{
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            opacity: 0,
            zIndex: 90,
            boxShadow: "0 0 0 200vmax rgba(2,0,30,.84)",
            border: "1px solid rgba(212,175,55,.4)",
          }}
        />
      </div>

      {/* ---- intro: the thank-you moment ---- */}
      {phase === "intro" && (
        <>
          {/* the black is its own sheet, opaque from the first frame so the demo
              stage never shows through. The root's fade carries it over home;
              the copy above trails by a beat, so the words resolve into midnight
              instead of crossfading through the home page underneath. */}
          <div aria-hidden className="absolute inset-0 z-[9] bg-bg" />
          <div
            className="absolute inset-0 z-[10] flex flex-col items-center justify-center px-6 text-center"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown || reduced ? "none" : "translateY(14px)",
              transition: reduced ? "none" : `opacity .65s ease .3s, transform .65s ${EASE} .3s`,
            }}
          >
            {/* one soft, slowly breathing wash — the only decoration */}
            {/* centering lives in the transform (and its keyframe) alone — a
                Tailwind -translate-* here sets the separate `translate` property
                and would compose with it, shoving the glow off-screen */}
            <div
              aria-hidden
              className="gf-thanks-glow pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[900px] max-w-[120vw]"
              style={{
                transform: "translate(-50%,-58%)",
                // the green is the half that tints the 1M figure toward olive,
                // so it takes the cut and the gold roughly holds its own
                background:
                  "radial-gradient(closest-side, rgba(57,211,83,.09), transparent 70%), radial-gradient(closest-side, rgba(212,175,55,.08), transparent 72%)",
              }}
            />

            <div className="font-mono text-[11px] font-semibold tracking-[.4em] text-brand">
              ONE MONTH OF GITFUT
            </div>

            {/* every language stacked in a single grid cell: the block keeps one
                width no matter which word is showing */}
            <div className="mt-[clamp(16px,3vh,26px)] grid place-items-center">
              {THANKS.map((w, i) => (
                <span
                  key={w.lang}
                  lang={w.lang}
                  dir={w.rtl ? "rtl" : undefined}
                  className="font-sans text-[clamp(54px,8.4vw,108px)] font-light leading-[1.12] tracking-[-0.03em] text-ink"
                  style={{
                    gridArea: "1 / 1",
                    fontFamily: w.font,
                    opacity: i === thanksIdx ? 1 : 0,
                    // out fast, in after the outgoing word has cleared — no two
                    // scripts ever ghost through each other
                    transition: i === thanksIdx ? "opacity 1s ease .6s" : "opacity .8s ease",
                  }}
                >
                  {w.text}
                </span>
              ))}
            </div>

            {/* no divider above the numbers: the only rule on this screen is the
                one under the CTA, so a line means "click me" and nothing else */}
            <div className="mt-[clamp(36px,6vh,60px)] flex flex-wrap items-start justify-center gap-x-[clamp(30px,6vw,72px)] gap-y-6">
              {STATS.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-[7px]">
                  <span
                    className={`font-sans text-[clamp(26px,3.4vw,40px)] font-light leading-none tracking-[-0.02em] ${
                      s.gold ? "text-gold-hi" : "text-ink"
                    }`}
                  >
                    <CountUp
                      to={s.to}
                      decimals={s.decimals}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      delay={s.delay}
                      run={shown}
                    />
                  </span>
                  <span className="font-mono text-[10px] font-semibold tracking-[.24em] text-ink-mute">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* the way in, in the same mono micro-caps voice as the eyebrow and
                the stat labels, closed by a green hairline — the one live thing
                on a still screen */}
            <button
              type="button"
              onClick={start}
              tabIndex={ctaIn ? 0 : -1}
              aria-hidden={!ctaIn}
              className="group mt-[clamp(30px,5vh,52px)] cursor-pointer rounded-md px-3 py-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              style={{
                opacity: ctaIn ? 1 : 0,
                transform: ctaIn || reduced ? "none" : "translateY(7px)",
                pointerEvents: ctaIn ? "auto" : "none",
                transition: reduced ? "none" : `opacity .9s ease, transform .9s ${EASE}`,
              }}
            >
              <span className="font-mono text-[11px] font-semibold tracking-[.3em] text-ink-soft transition-colors duration-300 group-hover:text-ink group-focus-visible:text-ink">
                SEE WHAT WE BUILT
              </span>
              {/* draws itself open under the words as they land: the one bit of
                  choreography on a still screen, and the only thing telling you
                  this line is a control */}
              <span
                aria-hidden
                className="mt-[9px] block h-px opacity-45 group-hover:opacity-100 group-hover:drop-shadow-[0_0_6px_rgba(57,211,83,.55)] group-focus-visible:opacity-100"
                style={{
                  background: "linear-gradient(90deg,transparent,var(--color-brand),transparent)",
                  transform: reduced ? "none" : `scaleX(${ctaIn ? 1 : 0})`,
                  transition: reduced ? "none" : `transform 1.1s ${EASE} .15s, opacity .3s ease, filter .3s ease`,
                }}
              />
            </button>
          </div>
        </>
      )}

      {/* ---- tour chrome: caption hugging the spotlight, controls docked ---- */}
      {phase === "tour" && caption && (
        <div
          key={`${caption.step.key}-cap`}
          className="pointer-events-none absolute z-[10] w-[min(470px,88vw)]"
          style={{
            ...caption.style,
            opacity: 0,
            animation: `gf-tour-cap .5s ease ${Math.max(caption.landMs - 250, 0)}ms forwards`,
          }}
        >
          <div className="rounded-2xl border border-white/[0.08] bg-bg/85 px-6 py-4 text-center backdrop-blur-[6px]">
            <div className="font-display text-[13px] font-bold tracking-[.28em] text-gold">
              {caption.step.kicker}
            </div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink">{caption.step.body}</p>
          </div>
        </div>
      )}

      {phase === "tour" && (
        <div className="absolute inset-x-0 bottom-[26px] z-[10] flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="cursor-pointer rounded-lg px-4 py-2 text-[13.5px] font-semibold text-ink-soft transition hover:text-ink disabled:cursor-default disabled:opacity-25 disabled:hover:text-ink-soft"
          >
            back
          </button>
          <div className="flex items-center gap-[7px]">
            {steps.map((s, i) => (
              <span
                key={s.key}
                className="h-[6px] w-[6px] rounded-full transition-colors duration-300"
                style={{ background: i === idx ? "var(--color-brand)" : "rgba(255,255,255,.22)" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            className="cursor-pointer rounded-lg border border-white/15 bg-white/[0.06] px-5 py-2 text-[13.5px] font-semibold text-ink transition hover:bg-white/[0.12]"
          >
            {last ? "finish" : "next"}
          </button>
          <button
            type="button"
            onClick={finish}
            className="cursor-pointer text-[12.5px] text-ink-mute underline-offset-2 transition hover:text-ink hover:underline"
          >
            skip
          </button>
        </div>
      )}

      <style>{`
        @keyframes gf-tour-cap { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes gf-thanks-breathe { 0%,100% { opacity: .75; transform: translate(-50%,-58%) scale(1); } 50% { opacity: 1; transform: translate(-50%,-58%) scale(1.06); } }
        .gf-thanks-glow { animation: gf-thanks-breathe 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .gf-thanks-glow { animation: none; } }
      `}</style>
    </div>
  );
}
