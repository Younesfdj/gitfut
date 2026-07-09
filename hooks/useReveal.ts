"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Finish } from "@/lib/scoring/types";
import { type DuelPhase, type RevealPhase, duelSequenceFor, sequenceFor } from "@/lib/reveal";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Layout effect on the client so the first phase lands BEFORE the browser
// paints; plain effect on the server, where useLayoutEffect only warns and does
// nothing. Both reveal hooks drive their sequence through this.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Drives the reveal phases from the pure sequencer. The animation renders off
// the returned phase. The component is keyed by login at the call site, so a
// new card remounts the hook — no mid-life finish swap to reconcile.
export function useReveal(finish: Finish): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>(() => sequenceFor(finish, false)[0]?.phase ?? "rise");

  useIsomorphicLayoutEffect(() => {
    const steps = sequenceFor(finish, prefersReducedMotion());
    // Land the first step synchronously, before paint. On the animated path
    // that's "rise" (already the initial state — a no-op set). Under reduced
    // motion the whole sequence IS that one step ("freeze"), so we jump straight
    // to the lit hero frame instead of stranding on the unlit "rise".
    setPhase(steps[0].phase);
    const timers = steps.slice(1).map((s) => setTimeout(() => setPhase(s.phase), s.at));
    return () => timers.forEach(clearTimeout);
  }, [finish]);

  return phase;
}

// Drives the Duel broadcast from the pure duel sequencer, plus a skip() that
// jumps straight to "settled" (tap-to-skip) and cancels every pending step.
export function useDuelReveal(): { phase: DuelPhase; skip: () => void } {
  const [phase, setPhase] = useState<DuelPhase>(() => duelSequenceFor(false)[0]?.phase ?? { kind: "walkout" });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useIsomorphicLayoutEffect(() => {
    const steps = duelSequenceFor(prefersReducedMotion());
    // Same contract as useReveal: the first step lands before paint. On the
    // animated path that's "walkout" (already the initial state); under reduced
    // motion it's the lone "settled" step, so the broadcast is skipped whole —
    // no walkout, no flash of the masked kick-off frame.
    setPhase(steps[0].phase);
    timers.current = steps.slice(1).map((s) => setTimeout(() => setPhase(s.phase), s.at));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase({ kind: "settled" });
  }, []);

  return { phase, skip };
}
