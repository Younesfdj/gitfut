"use client";

import { useEffect, useRef, useState } from "react";
import SPRITES from "@/data/award-sprites.json";

// The ball toy: a small football resting bottom-left. Click it and it becomes
// your cursor — the baked tumbling-ball sprite (see scripts/bake-award-sprites)
// trailing the pointer. Right-click or Escape puts it back. Opt-in by design:
// the real cursor only hides while you're dribbling (html.gf-ball-cursor, see
// globals.css), so a slow load or WebGL-less device can never strand anyone
// cursorless. Fine-pointer devices only — touch never sees it.
const BALL = SPRITES.ball;
const SIZE = 44;

const frameStyle = {
  backgroundImage: "url(/awards/ball.webp)",
  backgroundSize: `${BALL.cols * SIZE}px ${Math.ceil(BALL.frames / BALL.cols) * SIZE}px`,
};

export default function BallCursor() {
  const [dribbling, setDribbling] = useState(false);
  const ballRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!dribbling) return;
    const el = ballRef.current;
    if (!el) return;
    document.documentElement.classList.add("gf-ball-cursor");

    // Ball starts where it was clicked and eases toward the pointer — the
    // trailing feel of the original, with the loop properly torn down.
    let { x, y } = startRef.current;
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
      setDribbling(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDribbling(false);
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
  }, [dribbling]);

  if (dribbling) {
    return (
      <div
        ref={ballRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[999] will-change-transform"
        style={{ ...frameStyle, width: SIZE, height: SIZE }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        startRef.current = { x: e.clientX, y: e.clientY };
        setDribbling(true);
      }}
      aria-label="Take the ball for a dribble"
      title="Take the ball for a dribble — right-click to put it back"
      className="fixed bottom-[clamp(14px,3vh,22px)] left-[clamp(14px,3vw,22px)] z-40 hidden rounded-full transition-transform duration-200 hover:scale-110 active:scale-95 [@media(pointer:fine)]:block"
    >
      <div aria-hidden className="animate-float" style={{ ...frameStyle, width: SIZE, height: SIZE }} />
    </button>
  );
}
