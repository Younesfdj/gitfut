import { countryForLogin } from "../geo";
import { topLanguageLogo } from "../github/languages";
import { deriveMetrics, deriveSkillMoves, deriveStyle, deriveWeakFoot, deriveWorkRate } from "./attributes";
import { ATTACK_STATS, FINISH_LABELS, FOUNDER_OVERALL, FOUNDERS, K, STATS, WEIGHTS } from "./constants";
import { derivePlaystyles } from "./playstyles";
import { generateSquadNumber } from "./squadNumber";

import type {
  Archetype,
  Card,
  Family,
  Finish,
  Position,
  Profile,
  Signals,
  StatKey,
  Stats,
} from "./types";

const Lg = (x: number) => Math.log10(Math.max(0, x) + 1);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const vals = (s: Profile) => STATS.map((k) => s[k]);

// §2 — raw estimates, tuned so the six land on a comparable scale.
function rawStats(s: Signals): Stats {
  const o: Stats = {
    pac: 36 + 12 * Lg(s.recent_contributions),
    sho: 36 + 13 * Lg(s.total_stars_owned) + 5 * Lg(s.max_repo_stars),
    pas: 40 + 12 * Lg(s.prs_to_others) + 9 * Lg(s.followers),
    // DRI = genuine range, square-root scaled so breadth has diminishing returns:
    // ~65 at one language, ~80 at ten, ~85 at fifteen. The old linear count
    // saturated (8 languages already ~94, maxed at 9), letting a noisy signal own
    // the card and crown every polyglot a Fantasista.
    dri: 58 + 7 * Math.sqrt(s.languages),
    def: 40 + 14 * Lg(s.reviews + s.issues_closed),
    phy: 40 + 9 * Lg(s.total_contributions_lifetime) + 2.2 * Math.min(s.active_years, 12),
  };
  for (const k of STATS) o[k] = clamp(Math.round(o[k]), 1, 99);
  return o;
}

// §3.1 — magnitude → gravity-well center the stats sit around.
function center(s: Signals): number {
  const { w1, w2, w3, w4, b, lo, hi } = K.magnitude;
  const M = sigmoid(
    w1 * Lg(s.total_stars_owned) +
      w2 * Lg(s.followers) +
      w3 * Lg(s.total_contributions_lifetime) +
      w4 * s.account_age_years +
      b,
  );
  return lerp(lo, hi, M);
}

// §3.2 — z-score of their own six.
function zscore(raw: Stats): Profile {
  const v = vals(raw);
  const m = mean(v);
  const sd = Math.sqrt(mean(v.map((x) => (x - m) ** 2))) || 1;
  const p = {} as Profile;
  STATS.forEach((k, i) => (p[k] = (v[i] - m) / sd));
  return p;
}

// §3.3 — penalise antagonist pairs so nobody is elite at everything.
function applyTension(p: Profile): Profile {
  const out = { ...p };
  for (const [a, b] of K.tension.pairs) {
    const overlap = Math.max(0, Math.min(out[a], out[b]));
    const weaker = out[a] <= out[b] ? a : b;
    out[weaker] -= K.tension.alpha * overlap;
  }
  return out;
}

// §3.4 — spike around center; specialists get spikier cards.
function spike(p: Profile, c: number): Stats {
  const v = vals(p);
  const lop = clamp((Math.max(...v) - Math.min(...v)) / 4, 0, 1);
  const spread = K.spike.base * (1 + lop);
  const m = mean(v);
  const raw = {} as Stats;
  STATS.forEach((k) => (raw[k] = c + spread * (p[k] - m)));
  // §3.5 — attacking cohesion: the technical four share sub-skills, so pull them
  // toward their own group mean (preserving order and their collective level)
  // before rounding. This kills the random-looking 18pt gaps between attacking
  // stats; DEF/PHY are left free to break away (role explains them).
  const am = mean(ATTACK_STATS.map((k) => raw[k]));
  ATTACK_STATS.forEach((k) => (raw[k] = am + K.spike.cohesion * (raw[k] - am)));
  const stats = {} as Stats;
  STATS.forEach((k) => (stats[k] = clamp(Math.round(raw[k]), 1, 99)));
  return stats;
}

function positionFromShape(st: Stats): { position: Position; family: Family } {
  const fam: Record<Family, number> = {
    Forward: st.sho + st.pac,
    Playmaker: st.pas + st.dri,
    Anchor: st.def + st.phy,
  };
  const family = (Object.keys(fam) as Family[]).sort((a, b) => fam[b] - fam[a])[0];
  const position: Position =
    family === "Forward"
      ? st.pac > st.sho
        ? "RW"
        : "ST"
      : family === "Playmaker"
        ? st.pas > st.dri
          ? "CM"
          : "CAM"
        : st.def > st.phy
          ? "CB"
          : "CDM";
  return { position, family };
}

// §3.6 — position-weighted, never a flat mean; stats alone cap at 88.
function weightedOVR(stats: Stats, family: Family): number {
  const w = WEIGHTS[family];
  const ovr = STATS.reduce((s, k) => s + stats[k] * w[k], 0);
  return Math.min(Math.round(ovr), K.ovrCap);
}

// §4 — the 88→99 range is bought with years and sustained influence.
function legacyScore(s: Signals): number {
  const { a, b, c, d, e, f, activeCap } = K.legacy;
  const z =
    a * Math.log(s.account_age_years + 1) +
    b * Math.min(s.active_years, activeCap) +
    c * Lg(s.followers) +
    d * Lg(s.total_stars_owned) +
    e * Lg(s.max_repo_stars) -
    f;
  return sigmoid(z);
}

function pickFinish(overall: number, L: number, recentSpike: boolean, login: string): Finish {
  if (K.iconAllowlist.includes(login) || overall >= K.finish.iconMin) return "icon";
  if (overall >= K.finish.totyMin && L >= K.finish.totyLegacy) return "toty";
  if (recentSpike && overall >= K.finish.silverMin) return "totw";
  if (overall >= K.finish.goldMin) return "gold";
  if (overall >= K.finish.silverMin) return "silver";
  return "bronze";
}

function archetypeFromShape(st: Stats, finish: Finish): Archetype {
  if (finish === "icon")
    return { name: "Galáctico", blurb: "hall-of-fame maintainer — high and balanced, earned over years" };
  const top = [...STATS].sort((a, b) => st[b] - st[a]);
  const peak = st[top[0]];
  const top2 = top.slice(0, 2);
  const has = (a: StatKey, b: StatKey) => top2.includes(a) && top2.includes(b);
  if (top[0] === "sho" && st.def < peak - 18 && st.pas < peak - 12)
    return { name: "Poacher", blurb: "one viral repo, clinical — a pure star-magnet finisher" };
  if (top[0] === "pas" && top2.includes("def"))
    return { name: "Regista", blurb: "deep playmaker — coordinates from the back with cross-repo PRs and reviews" };
  if (top[0] === "def" && top2.includes("pas"))
    return { name: "Libero", blurb: "ball-playing sweeper — a reviewer who also builds, keeping the codebase clean" };
  if (top[0] === "dri")
    return { name: "Fantasista", blurb: "the magician — a polyglot working across many stacks" };
  if (has("phy", "sho")) return { name: "Target Man", blurb: "a prolific shipper whose output lands" };
  if (has("phy", "pac") || has("pac", "dri"))
    return { name: "Mezzala", blurb: "the engine — a relentless box-to-box daily-driver" };
  if (top[0] === "def")
    return { name: "Libero", blurb: "ball-playing sweeper — a reviewer who also builds, keeping the codebase clean" };
  if (top[0] === "sho")
    return { name: "Poacher", blurb: "one viral repo, clinical — a pure star-magnet finisher" };
  return { name: "Mezzala", blurb: "the engine — a relentless box-to-box daily-driver" };
}

export function buildCard(s: Signals): Card {
  const stats = spike(applyTension(zscore(rawStats(s))), center(s));
  const { position, family } = positionFromShape(stats);
  const baseOVR = weightedOVR(stats, family);
  const L = legacyScore(s);

  // Founders get a forced overall (>89) and the bespoke "founder" tier. We drive
  // `finish` directly rather than via pickFinish: any overall >= 90 would
  // otherwise auto-promote to ICON (and flip club/archetype), hijacking the look.
  const founder = FOUNDERS[s.login.toLowerCase()];
  const overall = founder
    ? FOUNDER_OVERALL[s.login.toLowerCase()]
    : clamp(baseOVR + Math.round(K.legacy.bonusMax * L), 1, 99);
  const finish: Finish = founder ? "founder" : pickFinish(overall, L, s.recent_spike, s.login);
  const archetype = founder
    ? { name: "Founder", blurb: "co-founder of GitFut — they built the very scout reading this card" }
    : archetypeFromShape(stats, finish);
  const skill = deriveSkillMoves(s);
  const weak = deriveWeakFoot(stats);
  const work = deriveWorkRate(stats);
  const style = deriveStyle(s);
  // Headline language's own catalog logo (null when it has none) — never a
  // different language's icon, so the logo always matches `topLanguage`.
  const languageLogo = topLanguageLogo(s.rankedLanguages ?? []);
  return {
    login: s.login,
    name: s.name,
    avatarUrl: s.avatarUrl,
    country: countryForLogin(s.login, s.location) ?? "",
    club: finish === "icon" ? "legends" : "neutral",
    stats,
    position,
    family,
    baseOVR,
    overall,
    finish,
    finishLabel: FINISH_LABELS[finish],
    archetype: archetype.name,
    archetypeBlurb: archetype.blurb,
    topLanguage: s.topLanguage ?? null,
    languageLogo,
    ...(founder ? { founder } : null),
    legacy: { L },
    squadNumber: generateSquadNumber(s.login, position, overall),
    report: {
      skillMoves: skill.value,
      weakFoot: weak.value,
      workRate: { attack: work.attack, defense: work.defense },
      style: style.value,
      reasons: {
        skillMoves: skill.reason,
        weakFoot: weak.reason,
        workRate: work.reason,
        style: style.reason,
      },
      playstyles: derivePlaystyles(s),
      metrics: deriveMetrics(s),
    },
  };
}
