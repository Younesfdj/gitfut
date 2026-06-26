"use client";

import { useEffect, useState } from "react";
import type { Finish } from "@/lib/scoring/types";
import { type RevealPhase, sequenceFor } from "@/lib/reveal";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Drives the reveal phases from the pure sequencer. The animation renders off
// the returned phase. The component is keyed by login at the call site, so a
// new card remounts the hook — no mid-life finish swap to reconcile.
export function useReveal(finish: Finish): RevealPhase {
  // Lazy initializer: first phase computed once, no synchronous setState needed.
  const [phase, setPhase] = useState<RevealPhase>(
    () => sequenceFor(finish, false)[0]?.phase ?? "rise",
  );

  useEffect(() => {
    const steps = sequenceFor(finish, prefersReducedMotion());
    const timers = steps.slice(1).map((s) => setTimeout(() => setPhase(s.phase), s.at));
    return () => timers.forEach(clearTimeout);
  }, [finish]);

  return phase;
}
