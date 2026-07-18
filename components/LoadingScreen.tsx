"use client";

import { useEffect, useState } from "react";
import Mascot from "./Mascot";
import { punAt } from "@/lib/puns";

// Full-screen loading state shown while the card image is generated. Mascot
// juggles the WC26 ball under a pulsing spotlight halo; a football-git pun
// rotates every ~1.8s. The progress bar has a stadium-tunnel glow effect.
export default function LoadingScreen({ login }: { login?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative z-[2] flex h-[100dvh] flex-col items-center justify-center px-6 text-center">
      {/* ambient spotlight halo behind mascot — breathes with loading */}
      <div className="relative">
        <div
          aria-hidden
          className="animate-halo-breathe pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(57,211,83,.22), rgba(57,211,83,.05) 60%, transparent 100%)",
            filter: "blur(20px)",
          }}
        />
        <Mascot size={220} kick ball />
      </div>

      <div className="font-display mt-8 text-[clamp(30px,5vw,52px)] leading-none tracking-[.02em] text-ink">
        SCOUTING{" "}
        {login && <span className="font-mono align-middle text-[0.5em] text-brand">@{login}</span>}
      </div>

      {/* rotating pun line */}
      <p
        key={tick}
        className="animate-pun-in mt-3 h-6 text-[15px] font-medium text-ink-soft"
        aria-live="polite"
      >
        {punAt(tick)}
      </p>

      {/* stadium-tunnel progress bar — wider with a green gradient glow */}
      <div className="mt-7 h-[5px] w-[min(280px,72vw)] overflow-hidden rounded-full bg-white/[0.07] shadow-[0_0_20px_rgba(57,211,83,.15)]">
        <div
          className="h-full w-1/3 rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent, #39d353 40%, #56e06b 60%, transparent)",
            boxShadow: "0 0 12px rgba(57,211,83,.6), 0 0 4px rgba(57,211,83,.8)",
            animation: "tunnel-glow 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </main>
  );
}
