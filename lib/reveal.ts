import type { Finish } from "@/lib/scoring/types";

// Reveal sequencer — a pure, tier-driven state machine. Given a card finish and
// the user's reduced-motion preference, it returns the timed phases of the
// "walkout": the card rises out of darkness, its tier glow ignites, the rare
// tiers get a burst (light + confetti + key-change), and it freezes on the
// clean hero shot (the screenshot frame). No DOM, no side effects — the React
// layer subscribes to these phases.

export type RevealPhase = "rise" | "ignite" | "burst" | "freeze";

export interface RevealStep {
  phase: RevealPhase;
  at: number; // ms offset from reveal start
}

// Tiers that earn the full spectacle (TOTY + Icon/Legend). TOTW (in-form) also
// gets a modest burst because it is, by definition, a rare "event" card.
const BURST_TIERS: ReadonlySet<Finish> = new Set<Finish>(["toty", "icon", "totw"]);

export function hasBurst(finish: Finish): boolean {
  return BURST_TIERS.has(finish);
}

export function sequenceFor(finish: Finish, reducedMotion: boolean): RevealStep[] {
  // Accessibility: collapse straight to the hero frame — same payoff, no motion.
  if (reducedMotion) return [{ phase: "freeze", at: 0 }];

  const steps: RevealStep[] = [
    { phase: "rise", at: 0 },
    { phase: "ignite", at: 620 },
  ];

  if (hasBurst(finish)) {
    steps.push({ phase: "burst", at: 1040 });
    steps.push({ phase: "freeze", at: 1560 });
  } else {
    steps.push({ phase: "freeze", at: 1180 });
  }

  return steps;
}

// Total wall-clock duration of the sequence (ms) — handy for callers that want
// to know when the reveal has settled.
export function sequenceDuration(finish: Finish, reducedMotion: boolean): number {
  const steps = sequenceFor(finish, reducedMotion);
  return steps[steps.length - 1]?.at ?? 0;
}
