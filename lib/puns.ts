// Loading-screen pun bank — football × git. Pure data + a deterministic
// rotation helper so the loading screen stays lively without randomness.
//
// i18n note: the canonical home of these strings is now lib/i18n/dict/<locale>.ts
// under the `puns` key. This file is preserved as the ENGLISH fallback so
// legacy callers (and the OG image generator, which pins to EN) continue to
// work without any code change on their side.

import { en as enDict } from "./i18n/dict/en";

export const PUNS: readonly string[] = enDict.puns;

// Stable line for a given tick — callers advance `tick` on an interval.
export function punAt(tick: number, puns: readonly string[] = PUNS): string {
  if (!puns.length) return "";
  return puns[((tick % puns.length) + puns.length) % puns.length];
}
