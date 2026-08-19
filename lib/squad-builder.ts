import type { Card, Position, StatKey } from "./scoring/types";

// Formation definitions: each slot maps to a position requirement.
// Positions not in the original 6 (ST, RW, CAM, CM, CDM, CB) are
// synthetic — assigned to players whose stat profile fits, with a
// positional-fit penalty when they're out of their natural position.

export interface FormationSlot {
  position: Position;
  label: string; // display label (e.g. "GK", "LB")
  x: number; // pitch x 0-100 (left-right)
  y: number; // pitch y 0-100 (bottom-top, GK=0)
}

export interface Formation {
  name: string;
  slots: FormationSlot[];
}

// Stat weights per target position — how much each attribute matters
// for that role. Used to score a player's positional fit.
const POSITION_WEIGHTS: Record<Position, Partial<Record<StatKey, number>>> = {
  GK:  { pac: 0.05, sho: 0.05, pas: 0.15, dri: 0.15, def: 0.30, phy: 0.30 },
  CB:  { pac: 0.10, sho: 0.05, pas: 0.10, dri: 0.10, def: 0.40, phy: 0.25 },
  LB:  { pac: 0.25, sho: 0.05, pas: 0.20, dri: 0.20, def: 0.20, phy: 0.10 },
  RB:  { pac: 0.25, sho: 0.05, pas: 0.20, dri: 0.20, def: 0.20, phy: 0.10 },
  CDM: { pac: 0.10, sho: 0.05, pas: 0.20, dri: 0.15, def: 0.35, phy: 0.15 },
  CM:  { pac: 0.10, sho: 0.10, pas: 0.25, dri: 0.25, def: 0.15, phy: 0.15 },
  CAM: { pac: 0.15, sho: 0.15, pas: 0.25, dri: 0.25, def: 0.05, phy: 0.15 },
  LW:  { pac: 0.25, sho: 0.15, pas: 0.15, dri: 0.25, def: 0.05, phy: 0.15 },
  LM:  { pac: 0.25, sho: 0.10, pas: 0.20, dri: 0.25, def: 0.10, phy: 0.10 },
  RW:  { pac: 0.25, sho: 0.15, pas: 0.15, dri: 0.25, def: 0.05, phy: 0.15 },
  RM:  { pac: 0.25, sho: 0.10, pas: 0.20, dri: 0.25, def: 0.10, phy: 0.10 },
  ST:  { pac: 0.20, sho: 0.30, pas: 0.10, dri: 0.20, def: 0.05, phy: 0.15 },
};

// Natural position → group for compatibility scoring.
const POSITION_GROUP: Record<Position, string> = {
  GK: "gk",
  CB: "defense",
  LB: "defense",
  RB: "defense",
  CDM: "midfield",
  CM: "midfield",
  CAM: "midfield",
  LW: "attack",
  LM: "attack",
  RW: "attack",
  RM: "attack",
  ST: "attack",
};

// How well does a player fit a target position?
// Returns 0–1: 1.0 = natural position, lower = increasingly out of position.
export function positionFit(card: Card, target: Position): number {
  if (card.position === target) return 1.0;

  const sameGroup = POSITION_GROUP[card.position] === POSITION_GROUP[target];
  if (!sameGroup) return 0.35;

  // Weighted stat match: how well do this player's stats align with the target position's needs?
  const weights = POSITION_WEIGHTS[target];
  let fitScore = 0;
  for (const [stat, w] of Object.entries(weights) as [StatKey, number][]) {
    fitScore += (card.stats[stat] / 99) * w;
  }
  // Scale to 0.60–0.90 range for same-group, different-position
  return 0.60 + fitScore * 0.30;
}

// Score a player in a position: OVR * positional fit.
function slotScore(card: Card, target: Position): number {
  return card.overall * positionFit(card, target);
}

// --- Formations ---

export const FORMATIONS: Formation[] = [
  {
    name: "4-3-3",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "LB", label: "LB", x: 15, y: 20 },
      { position: "CB", label: "CB", x: 38, y: 20 },
      { position: "CB", label: "CB", x: 62, y: 20 },
      { position: "RB", label: "RB", x: 85, y: 20 },
      { position: "CM", label: "CM", x: 35, y: 48 },
      { position: "CM", label: "CM", x: 50, y: 45 },
      { position: "CM", label: "CM", x: 65, y: 48 },
      { position: "LW", label: "LW", x: 20, y: 78 },
      { position: "ST", label: "ST", x: 50, y: 82 },
      { position: "RW", label: "RW", x: 80, y: 78 },
    ],
  },
  {
    name: "4-2-3-1",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "LB", label: "LB", x: 15, y: 20 },
      { position: "CB", label: "CB", x: 38, y: 20 },
      { position: "CB", label: "CB", x: 62, y: 20 },
      { position: "RB", label: "RB", x: 85, y: 20 },
      { position: "CDM", label: "CDM", x: 38, y: 38 },
      { position: "CDM", label: "CDM", x: 62, y: 38 },
      { position: "CAM", label: "CAM", x: 50, y: 56 },
      { position: "LW", label: "LW", x: 20, y: 56 },
      { position: "RW", label: "RW", x: 80, y: 56 },
      { position: "ST", label: "ST", x: 50, y: 82 },
    ],
  },
  {
    name: "4-4-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "LB", label: "LB", x: 15, y: 20 },
      { position: "CB", label: "CB", x: 38, y: 20 },
      { position: "CB", label: "CB", x: 62, y: 20 },
      { position: "RB", label: "RB", x: 85, y: 20 },
      { position: "LM", label: "LM", x: 15, y: 50 },
      { position: "CM", label: "CM", x: 38, y: 50 },
      { position: "CM", label: "CM", x: 62, y: 50 },
      { position: "RM", label: "RM", x: 85, y: 50 },
      { position: "ST", label: "ST", x: 38, y: 82 },
      { position: "ST", label: "ST", x: 62, y: 82 },
    ],
  },
  {
    name: "4-3-1-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "LB", label: "LB", x: 15, y: 20 },
      { position: "CB", label: "CB", x: 38, y: 20 },
      { position: "CB", label: "CB", x: 62, y: 20 },
      { position: "RB", label: "RB", x: 85, y: 20 },
      { position: "CM", label: "CM", x: 30, y: 48 },
      { position: "CM", label: "CM", x: 50, y: 45 },
      { position: "CM", label: "CM", x: 70, y: 48 },
      { position: "CAM", label: "CAM", x: 50, y: 64 },
      { position: "ST", label: "ST", x: 38, y: 82 },
      { position: "ST", label: "ST", x: 62, y: 82 },
    ],
  },
  {
    name: "3-5-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "CB", label: "CB", x: 25, y: 20 },
      { position: "CB", label: "CB", x: 50, y: 20 },
      { position: "CB", label: "CB", x: 75, y: 20 },
      { position: "LM", label: "LM", x: 10, y: 50 },
      { position: "CDM", label: "CDM", x: 38, y: 42 },
      { position: "CM", label: "CM", x: 50, y: 48 },
      { position: "CDM", label: "CDM", x: 62, y: 42 },
      { position: "RM", label: "RM", x: 90, y: 50 },
      { position: "ST", label: "ST", x: 38, y: 82 },
      { position: "ST", label: "ST", x: 62, y: 82 },
    ],
  },
  {
    name: "4-1-2-1-2",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "LB", label: "LB", x: 15, y: 20 },
      { position: "CB", label: "CB", x: 38, y: 20 },
      { position: "CB", label: "CB", x: 62, y: 20 },
      { position: "RB", label: "RB", x: 85, y: 20 },
      { position: "CDM", label: "CDM", x: 50, y: 36 },
      { position: "LM", label: "LM", x: 25, y: 52 },
      { position: "RM", label: "RM", x: 75, y: 52 },
      { position: "CAM", label: "CAM", x: 50, y: 64 },
      { position: "ST", label: "ST", x: 38, y: 82 },
      { position: "ST", label: "ST", x: 62, y: 82 },
    ],
  },
  {
    name: "3-4-2-1",
    slots: [
      { position: "GK", label: "GK", x: 50, y: 2 },
      { position: "CB", label: "CB", x: 25, y: 20 },
      { position: "CB", label: "CB", x: 50, y: 20 },
      { position: "CB", label: "CB", x: 75, y: 20 },
      { position: "LM", label: "LM", x: 10, y: 50 },
      { position: "CM", label: "CM", x: 38, y: 48 },
      { position: "CM", label: "CM", x: 62, y: 48 },
      { position: "RM", label: "RM", x: 90, y: 50 },
      { position: "LW", label: "LW", x: 30, y: 74 },
      { position: "RW", label: "RW", x: 70, y: 74 },
      { position: "ST", label: "ST", x: 50, y: 78 },
    ],
  },
];

// Alias LM as LW for position-fit scoring (they're the same wide-left role)
function normalizePosition(p: Position): Position {
  return p === "LM" ? "LW" : p;
}

export interface SquadResult {
  formation: string;
  xi: { card: Card; slot: FormationSlot; fit: number; adjustedOVR: number }[];
  bench: Card[];
  teamOVR: number;
}

// Try every formation, pick the one with the highest total squad score.
// Handles: < 11 players (fill what we can), GK emergency, no duplicates.
export function buildBestXI(players: Card[]): { best: SquadResult; all: SquadResult[] } {
  if (players.length === 0) {
    return {
      best: { formation: "4-3-3", xi: [], bench: [], teamOVR: 0 },
      all: [],
    };
  }

  // Pre-sort players by OVR descending for greedy slot filling
  const sorted = [...players].sort((a, b) => b.overall - a.overall);

  const results: SquadResult[] = [];

  for (const formation of FORMATIONS) {
    const used = new Set<string>(); // login keys
    const xi: SquadResult["xi"] = [];

    for (const slot of formation.slots) {
      const pos = normalizePosition(slot.position);
      let bestCard: Card | null = null;
      let bestFit = 0;
      let bestScore = -1;

      for (const card of sorted) {
        if (used.has(card.login)) continue;
        const fit = positionFit(card, pos);
        const score = slotScore(card, pos);
        if (score > bestScore) {
          bestScore = score;
          bestFit = fit;
          bestCard = card;
        }
      }

      if (bestCard) {
        used.add(bestCard.login);
        xi.push({
          card: bestCard,
          slot,
          fit: bestFit,
          adjustedOVR: Math.round(bestCard.overall * bestFit),
        });
      }
    }

    const teamOVR = xi.length > 0
      ? Math.round(xi.reduce((s, x) => s + x.adjustedOVR, 0) / xi.length)
      : 0;

    const bench = sorted.filter((c) => !used.has(c.login)).slice(0, 7);

    results.push({ formation: formation.name, xi, bench, teamOVR });
  }

  // Pick best by teamOVR (tiebreak: more XI slots filled, then fewer positional mismatches)
  const best = results.reduce((a, b) => {
    if (b.xi.length !== a.xi.length) return b.xi.length > a.xi.length ? b : a;
    if (b.teamOVR !== a.teamOVR) return b.teamOVR > a.teamOVR ? b : a;
    const aFit = a.xi.reduce((s, x) => s + x.fit, 0);
    const bFit = b.xi.reduce((s, x) => s + x.fit, 0);
    return bFit > aFit ? b : a;
  });

  return { best, all: results };
}
