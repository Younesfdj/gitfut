// Loading-screen pun bank — football × git. Pure data + a deterministic
// rotation helper so the loading screen stays lively without randomness.
export const PUNS: readonly string[] = [
  "Measuring your PRs (Penalty Resistance)…",
  "Calculating your xG (eXpected Greatness)…",
  "Checking VAR (Version & Review)…",
  "Counting clean sheets (zero-bug commits)…",
  "Reviewing the tape (your commit history)…",
  "Assessing first touch (force-push reflexes)…",
  "Timing your sprints (and your sprints)…",
  "Scouting your set pieces (merge conflicts)…",
  "Weighing your transfer fee (star count)…",
  "Inspecting your stamina (contribution streak)…",
  "Reading your through-balls (pull requests)…",
  "Grading your work rate (commits per night)…",
];

// Stable line for a given tick — callers advance `tick` on an interval.
export function punAt(tick: number): string {
  return PUNS[((tick % PUNS.length) + PUNS.length) % PUNS.length];
}
