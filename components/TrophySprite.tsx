"use client";

import { useEffect, useRef } from "react";
import SPRITES from "@/data/award-sprites.json";

// A baked "3D" trophy: a looping sprite sheet (see scripts/bake-award-sprites)
// played by stepping background-position — the rotating-model look with zero
// runtime 3D. Playback pauses off-viewport and never starts under
// prefers-reduced-motion (frame 0 is a fine still).
type SpriteKey = keyof typeof SPRITES;

export default function TrophySprite({
  sprite,
  size,
  className,
}: {
  sprite: SpriteKey;
  /** Rendered square edge in px; the sheet scales to it. */
  size: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = SPRITES[sprite];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(el);

    let raf = 0;
    let last = 0;
    let frame = 0;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (!visible || t - last < 1000 / meta.fps) return;
      last = t;
      frame = (frame + 1) % meta.frames;
      el.style.backgroundPosition = `${-(frame % meta.cols) * size}px ${-Math.floor(frame / meta.cols) * size}px`;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [meta, size]);

  const rows = Math.ceil(meta.frames / meta.cols);
  return (
    <div
      ref={ref}
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/awards/${sprite}.webp)`,
        backgroundSize: `${meta.cols * size}px ${rows * size}px`,
      }}
    />
  );
}
