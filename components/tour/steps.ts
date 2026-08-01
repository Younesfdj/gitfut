// The what's-new tour script: which element the camera visits and what the
// caption says. Targets are found by [data-tour] inside the tour's own demo
// stage (never the live page), so the tour can't spotlight the wrong instance.
// The ball stop only exists where the ball itself exists (BallCursor's desktop
// media query). Advancing is manual — next/back, never a timer.

export interface TourStep {
  key: "trophies" | "ball" | "duel";
  /** Matches a [data-tour=...] element inside the stage. */
  target: string;
  kicker: string;
  body: string;
  /** Padding around the target when framing it (px, pre-zoom). */
  pad: number;
  /** Zoom ceiling — small targets (the ball) may zoom harder. */
  maxScale: number;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    key: "trophies",
    target: "trophies",
    kicker: "THE TROPHY CABINET",
    body: "GitFut now hands out real silverware. Every trophy is judged on real GitHub history and carries the story of why it was won.",
    pad: 24,
    maxScale: 2.1,
  },
  {
    key: "ball",
    target: "ball",
    kicker: "THE MATCH BALL",
    body: "See it resting in the corner? Click it once and it becomes your cursor. A right click sends it home.",
    pad: 26,
    maxScale: 3.4,
  },
  {
    key: "duel",
    target: "duel",
    kicker: "DUEL A RIVAL",
    body: "Call out any dev on GitHub and settle it card against card.",
    pad: 26,
    maxScale: 2.2,
  },
];

/** The ball stop requires the ball — same media query BallCursor mounts on. */
export const BALL_MQ = "(pointer: fine) and (hover: hover) and (min-width: 768px)";

export const TOUR_STORAGE_KEY = "gitfut:tour:v1";
