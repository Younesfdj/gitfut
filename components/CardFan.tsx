"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";

const ANGLE = 7;
const SPREAD_CLOSED = 88;
const SPREAD_OPEN = 124;

interface Props {
  cards: Card[];
  onPick: (login: string) => void;
}

export default function CardFan({ cards, onPick }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const center = (cards.length - 1) / 2;

  // Parallax tracking: the card fan area shifts subtly opposite to mouse position,
  // giving the fan a sense of depth. The transform is driven imperatively to avoid
  // re-renders on every mousemove.
  const containerRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = parallaxRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const r = container.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1 to 1
    const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.transform = `translate(${-px * 6}px, ${-py * 4}px)`;
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = parallaxRef.current;
    if (el) el.style.transform = "translate(0, 0)";
    setOpen(false);
    setHover(null);
  }, []);

  // Cascade entrance: cards stagger in from below on mount.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const t = setTimeout(() => setEntered(true), reduced ? 0 : 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-[1.12] items-center justify-center"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center max-[860px]:hidden"
      >
        <div className="absolute aspect-square w-[min(330px,76%)] rounded-full border border-white/[0.06]" />
        <div
          className="font-display font-black leading-[.8] text-transparent"
          style={{ fontSize: "clamp(170px,22vw,300px)", WebkitTextStroke: "1.4px rgba(255,255,255,.045)" }}
        >
          99
        </div>
      </div>

      <div
        ref={parallaxRef}
        className="transition-transform duration-[600ms] ease-out"
      >
        <div
          className="relative h-[360px] w-[min(600px,98%)] max-[860px]:flex max-[860px]:h-auto max-[860px]:w-full max-[860px]:flex-col max-[860px]:items-center max-[860px]:gap-[18px]"
        >
          {cards.map((card, i) => {
            const off = i - center;
            const hovered = hover === i;
            const rot = open ? 0 : off * ANGLE;
            const tx = (open ? SPREAD_OPEN : SPREAD_CLOSED) * off;
            const ty = hovered ? -36 : open ? -4 : Math.abs(off) * 14;
            const sc = hovered ? 1.05 : 1;

            // Cascade entrance delay per card
            const entranceDelay = 300 + i * 120;

            return (
              <div
                key={card.login}
                onClick={() => onPick(card.login)}
                onMouseEnter={() => {
                  setHover(i);
                  setOpen(true);
                }}
                onMouseLeave={() => setHover(null)}
                className="absolute left-1/2 top-[18px] w-[184px] origin-bottom cursor-pointer transition-all duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] max-[860px]:static max-[860px]:w-[min(230px,66vw)] max-[860px]:!transform-none max-[860px]:!z-auto"
                style={{
                  transform: `translateX(-50%) translate(${tx}px, ${entered ? ty : ty + 60}px) rotate(${rot}deg) scale(${entered ? sc : 0.85})`,
                  zIndex: hovered ? 60 : 40 - i * 5,
                  opacity: entered ? 1 : 0,
                  transitionDelay: entered ? "0ms" : `${entranceDelay}ms`,
                }}
              >
                <PlayerCard card={card} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
