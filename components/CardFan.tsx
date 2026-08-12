"use client";

import { useState } from "react";
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

  return (
    <div className="relative flex min-w-0 flex-[1.12] items-center justify-center">
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
        onMouseLeave={() => {
          setOpen(false);
          setHover(null);
        }}
        className="relative h-[360px] w-[min(600px,98%)] max-[860px]:flex max-[860px]:h-auto max-[860px]:w-full max-[860px]:flex-col max-[860px]:items-center max-[860px]:gap-[18px]"
      >
        {cards.map((card, i) => {
          const off = i - center;
          const hovered = hover === i;
          const rot = open ? 0 : off * ANGLE;
          const tx = (open ? SPREAD_OPEN : SPREAD_CLOSED) * off;
          const ty = hovered ? -36 : open ? -4 : Math.abs(off) * 14;
          const sc = hovered ? 1.05 : 1;
          return (
            <button
              type="button"
              key={card.login}
              aria-label={`Scout ${card.name ?? card.login}`}
              onClick={() => onPick(card.login)}
              onFocus={() => {
                setHover(i);
                setOpen(true);
              }}
              onBlur={(event) => {
                const fan = event.currentTarget.parentElement;
                const next = event.relatedTarget;

                if (!(next instanceof Node) || !fan?.contains(next)) {
                  setOpen(false);
                  setHover(null);
                }
              }}
              onMouseEnter={() => {
                setHover(i);
                setOpen(true);
              }}
              onMouseLeave={() => setHover(null)}
              className="absolute left-1/2 top-[18px] w-[184px] origin-bottom cursor-pointer appearance-none border-0 bg-transparent p-0 text-inherit transition-transform duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#39d353] max-[860px]:static max-[860px]:w-[min(230px,66vw)] max-[860px]:!transform-none max-[860px]:!z-auto"
              style={{
                transform: `translateX(-50%) translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sc})`,
                zIndex: hovered ? 60 : 40 - i * 5,
              }}
            >
              <PlayerCard card={card} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
