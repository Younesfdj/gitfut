"use client";

import type { Card } from "@/lib/scoring/types";
import { Section } from "./ScoutReport";
import { resolveResultTheme } from "./finishTheme";

export default function PlayerNumber({ card }: { card: Card }) {
  const theme = resolveResultTheme(card);
  const accent = theme.ink;

  return (
    <Section title="SQUAD NUMBER" accent={accent} className="w-full mt-[14px]">
      <div className="flex items-center justify-between pt-1 pb-[2px]">
         <div 
           className="font-display text-center justify-center w-full text-[100px] font-black leading-none tabular-nums"
           style={{ color: accent, filter: `drop-shadow(0 1px 8px ${accent}55)` }}
         >
           {card.squadNumber}
         </div>
      </div>
    </Section>
  );
}
