"use client";

import { useRef } from "react";
import { round1 } from "@/lib/format";

// FUT-style hover physics for a card: it leans toward the cursor while a glassy
// specular streak sweeps with the pointer. The transform is driven imperatively
// on the element (no re-render per mousemove); the global reduced-motion rule
// zeroes the transitions, so for those viewers it's a functional no-frills hover.
//
// `maskSrc` clips the glass to the card's own silhouette — the same
// art-as-CSS-mask trick PlayerCard uses for the avatar — so the shine can never
// paint a rectangle outside the shield.
export default function TiltCard({ children, maskSrc }: { children: React.ReactNode; maskSrc?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${round1((0.5 - py) * 10)}deg) rotateY(${round1((px - 0.5) * 12)}deg)`;
    el.style.setProperty("--mx", `${round1(px * 100)}%`);
    el.style.setProperty("--my", `${round1(py * 100)}%`);
  };

  const leave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={move}
      onMouseLeave={leave}
      className="group/tilt relative transition-transform duration-200 ease-out will-change-transform"
    >
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
        style={{
          // glass: a sharp diagonal streak riding the pointer over a soft sheen
          background: `
            linear-gradient(115deg,
              transparent calc(var(--mx, 50%) - 22%),
              rgba(255,255,255,.05) calc(var(--mx, 50%) - 9%),
              rgba(255,255,255,.22) var(--mx, 50%),
              rgba(255,255,255,.06) calc(var(--mx, 50%) + 9%),
              transparent calc(var(--mx, 50%) + 20%)),
            radial-gradient(120% 90% at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,.10), transparent 60%)`,
          mixBlendMode: "screen",
          ...(maskSrc
            ? {
                WebkitMaskImage: `url("${maskSrc}")`,
                maskImage: `url("${maskSrc}")`,
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%",
              }
            : {}),
        }}
      />
    </div>
  );
}
