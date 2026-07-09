import type { Family, Finish, FounderMeta, StatKey, Stats } from "./types";

export const STATS: StatKey[] = ["pac", "sho", "pas", "dri", "def", "phy"];

// Canonical stat → display abbreviation: the single source for any surface that
// labels the six stats (the Duel's shootout rows read these).
export const STAT_LABELS: Record<StatKey, string> = {
  pac: "PAC",
  sho: "SHO",
  pas: "PAS",
  dri: "DRI",
  def: "DEF",
  phy: "PHY",
};

// The attacking/technical four share sub-skills in real FUT cards (dribbling and
// pace pull from the same agility/balance traits, etc.), so they're kept cohesive
// — pulled toward their own group mean after the spike. DEF/PHY stay free: role
// explains those (attackers are simply poor defenders), so they may break away.
export const ATTACK_STATS: StatKey[] = ["pac", "sho", "pas", "dri"];

export const K = {
  magnitude: { w1: 0.5, w2: 0.4, w3: 0.5, w4: 0.08, b: -2.8, lo: 48, hi: 82 },
  tension: {
    alpha: 0.7,
    pairs: [
      ["sho", "def"],
      ["dri", "phy"],
      ["pac", "def"],
    ] as [StatKey, StatKey][],
  },
  spike: { base: 8, cohesion: 0.6 },
  legacy: { a: 1.0, b: 0.7, c: 0.3, d: 0.3, e: 0.3, f: 6.0, activeCap: 15, bonusMax: 11 },
  ovrCap: 88,
  finish: { iconMin: 90, totyMin: 85, totyLegacy: 0.5, goldMin: 75, silverMin: 65 },
  iconAllowlist: ["torvalds"],
};

export const WEIGHTS: Record<Family, Stats> = {
  Forward: { pac: 0.2, sho: 0.3, pas: 0.1, dri: 0.2, def: 0.05, phy: 0.15 },
  Playmaker: { pac: 0.1, sho: 0.15, pas: 0.3, dri: 0.25, def: 0.1, phy: 0.1 },
  Anchor: { pac: 0.1, sho: 0.05, pas: 0.15, dri: 0.1, def: 0.4, phy: 0.2 },
};

export const FINISH_LABELS: Record<Finish, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  totw: "IN-FORM",
  toty: "TOTY",
  icon: "ICON",
  founder: "FOUNDER",
};

// The people who built gitfut. Keyed by LOWERCASE GitHub login; matched
// case-insensitively in buildCard. Each gets a forced overall (>89), bespoke
// card art (public/cards), and an accent that tints their card + scout report.
export const FOUNDERS: Record<string, FounderMeta> = {
  younesfdj: {
    art: "/cards/founder-red.png",
    accent: "#ff2f45",
    label: "FOUNDER",
    tagline: "Co-founder of gitfut",
  },
  mawsis: {
    art: "/cards/founder-chrome.png",
    accent: "#d8dde3",
    label: "FOUNDER",
    tagline: "Co-founder of gitfut",
  },
};

// Forced overalls (kept beside FOUNDERS but separate so the FounderMeta shape
// stays presentation-only). Both are >89 by design.
export const FOUNDER_OVERALL: Record<string, number> = {
  younesfdj: 93,
  mawsis: 91,
};
