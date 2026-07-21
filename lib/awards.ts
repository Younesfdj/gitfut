import type { Card } from "@/lib/scoring/types";

// The trophy cabinet: threshold awards a card has EARNED. One semantic
// everywhere — the profile shelf shows them, and duel corners simply showcase
// each player's existing cabinet (belts you walk in with, not prizes the match
// hands out), so a duel can never mint a trophy the profile would deny.
// Thresholds are v1 placeholders until the full trophy mechanism (repeat
// trophies, history) lands; they live here, next to the copy, so the views and
// the modal's "requires" line can never drift apart again.

export interface Award {
  key: "world_cup" | "golden_boot" | "golden_glove";
  title: string;
  /** Short caption under the trophy on a shelf. */
  shelfLabel: string;
  /** The badge pill in the details modal. */
  metricLabel: string;
  description: string;
  statLabel: "OVR" | "SHO" | "DEF";
  threshold: number;
  statOf: (card: Card) => number;
}

export const AWARDS: readonly Award[] = [
  {
    key: "world_cup",
    title: "World Cup Trophy",
    shelfLabel: "WORLD CUP",
    metricLabel: "Generational Champion",
    description:
      "The ultimate prize. Awarded to legendary champions whose overall rating reflects complete mastery across all aspects of software engineering.",
    statLabel: "OVR",
    threshold: 85,
    statOf: (card) => card.overall,
  },
  {
    key: "golden_boot",
    title: "Golden Boot",
    shelfLabel: "GOLDEN BOOT",
    metricLabel: "Elite Star Attraction",
    description:
      "Awarded to players who demonstrate world-class shooting power by attracting massive stars across their repositories.",
    statLabel: "SHO",
    threshold: 80,
    statOf: (card) => card.stats.sho,
  },
  {
    key: "golden_glove",
    title: "Golden Glove",
    shelfLabel: "GOLDEN GLOVE",
    metricLabel: "Clean Sheet Defender",
    description:
      "Awarded to the premier defenders of the codebase who keep the sheets clean through meticulous code reviews and issue resolutions.",
    statLabel: "DEF",
    threshold: 60,
    statOf: (card) => card.stats.def,
  },
];

/** The card's earned trophies, in cabinet order. */
export const earnedAwards = (card: Card): Award[] =>
  AWARDS.filter((a) => a.statOf(card) >= a.threshold);

/** The modal's qualifying-stat line, e.g. "OVR 87 (requires ≥ 85)". */
export const qualifyingStat = (award: Award, card: Card): string =>
  `${award.statLabel} ${award.statOf(card)} (requires ≥ ${award.threshold})`;
