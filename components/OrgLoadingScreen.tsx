"use client";

import { useEffect, useState } from "react";
import Mascot from "./Mascot";

// Loading screen for organization scouting — shows progressive status.
export default function OrgLoadingScreen({ login }: { login: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const steps = [
    "Finding organization…",
    "Gathering squad…",
    "Scouting players…",
    "Comparing formations…",
    "Building best XI…",
  ];

  return (
    <main className="relative z-[2] flex h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <Mascot size={220} kick ball />

      <div className="font-display mt-8 text-[clamp(28px,5vw,48px)] leading-none tracking-[.02em] text-ink">
        SCOUTING{" "}
        <span className="font-mono align-middle text-[0.5em] text-brand">{login}</span>{" "}
        FC
      </div>

      <div className="mt-4 h-5 text-[15px] font-medium text-ink-soft" aria-live="polite">
        {steps[tick % steps.length]}
      </div>

      {/* indeterminate progress sliver */}
      <div className="mt-7 h-[3px] w-[min(260px,70vw)] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-brand to-transparent"
          style={{ animation: "gf-load 1.3s ease-in-out infinite" }}
        />
      </div>

      <style>{`@keyframes gf-load{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}`}</style>
    </main>
  );
}
