"use client";

import { useEffect, useRef, useState } from "react";
import SPRITES from "@/data/award-sprites.json";

// The ball toy: a small football resting bottom-left. Click it and it becomes
// your cursor — the baked tumbling-ball sprite (see scripts/bake-award-sprites)
// trailing the pointer with an eased chase. Right-click or Escape releases it:
// the real cursor comes back instantly and the ball flies home on an ease-in.
// Opt-in by design — the cursor only hides mid-dribble — and desktop-only:
// mounted solely when a precise hovering pointer meets a desktop-wide screen.
const BALL = SPRITES.ball;
const SIZE = 44;
const DESKTOP_MQ = "(pointer: fine) and (hover: hover) and (min-width: 768px)";
const RETURN_MS = 450;

const frameStyle = {
  backgroundImage: "url(/awards/ball.webp)",
  backgroundSize: `${BALL.cols * SIZE}px ${Math.ceil(BALL.frames / BALL.cols) * SIZE}px`,
};

// The ball's resting center, mirroring the button's clamp() offsets.
const restPoint = () => {
  const inset = (px: number) => Math.min(Math.max(14, px * 0.03), 22);
  return {
    x: inset(window.innerWidth) + SIZE / 2,
    y: window.innerHeight - inset(window.innerHeight) - SIZE / 2,
  };
};

type Phase = "idle" | "dribble" | "return";

export default function BallCursor() {
  const [desktop, setDesktop] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const ballRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 }); // ball center, carried across phases

  // Mount only on sure-desktops; if the environment stops qualifying mid-play
  // (window shrunk, device emulation), drop straight back to nothing. Initial
  // sync is deferred (house pattern, see ResultView's seenHome) so the set
  // can't cascade a render.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => {
      setDesktop(mq.matches);
      if (!mq.matches) setPhase("idle");
    };
    const t = setTimeout(sync, 0);
    mq.addEventListener("change", sync);
    return () => {
      clearTimeout(t);
      mq.removeEventListener("change", sync);
    };
  }, []);

  // Dribble: eased chase after the pointer (ease-out feel — fast when far,
  // settling as it catches up), tumble playing, growing over clickables.
  useEffect(() => {
    if (phase !== "dribble") return;
    const el = ballRef.current;
    if (!el) return;
    document.documentElement.classList.add("gf-ball-cursor");

    let { x, y } = posRef.current;
    el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
    let mx = x;
    let my = y;
    let overClickable = false;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      overClickable = !!(e.target as Element | null)?.closest?.("a, button, [role='button'], label");
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault(); // right-click releases the ball, not the browser menu
      setPhase("return");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("return");
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    let frame = 0;
    let scale = 1;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      x += (mx - x) * 0.35;
      y += (my - y) * 0.35;
      posRef.current = { x, y };
      // Grow over clickable things — the original's "you can kick this" cue.
      scale += ((overClickable ? 1.6 : 1) - scale) * 0.2;
      el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0) scale(${scale.toFixed(3)})`;
      // The tumble plays only when motion is welcome; a still ball still works.
      if (!reduced && t - last >= 1000 / BALL.fps) {
        last = t;
        frame = (frame + 1) % BALL.frames;
        el.style.backgroundPosition = `${-(frame % BALL.cols) * SIZE}px ${-Math.floor(frame / BALL.cols) * SIZE}px`;
      }
    };
    raf = requestAnimationFrame(step);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("gf-ball-cursor");
    };
  }, [phase]);

  // Return: the ball flies home on a cubic ease-in — a slow push off, then
  // quick to the corner — while the real cursor is already back.
  useEffect(() => {
    if (phase !== "return") return;
    const el = ballRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("idle");
      return;
    }
    const from = { ...posRef.current };
    const to = restPoint();
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / RETURN_MS, 1);
      const e = p * p * p;
      const x = from.x + (to.x - from.x) * e;
      const y = from.y + (to.y - from.y) * e;
      el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
      if (p < 1) raf = requestAnimationFrame(step);
      else setPhase("idle");
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!desktop) return null;

  if (phase !== "idle") {
    // Positioned by the phase effects via el.style.transform (refs can't be
    // read during render); until then the transform below keeps it offscreen.
    return (
      <div
        ref={ballRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[999] -translate-x-full -translate-y-full will-change-transform"
        style={{ ...frameStyle, width: SIZE, height: SIZE }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        posRef.current = { x: e.clientX, y: e.clientY };
        setPhase("dribble");
      }}
      aria-label="Take the ball for a dribble"
      title="Take the ball for a dribble — right-click to put it back"
      className="fixed bottom-[clamp(14px,3vh,22px)] left-[clamp(14px,3vw,22px)] z-40 rounded-full transition-transform duration-200 hover:scale-110 active:scale-95"
    >
      <div aria-hidden className="animate-float" style={{ ...frameStyle, width: SIZE, height: SIZE }} />
    </button>
  );
}
