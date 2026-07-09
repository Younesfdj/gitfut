import { COUNTRIES } from "@/lib/countries";
import type { Finish, Position, StatKey } from "@/lib/scoring/types";
import type { TemplateVariable, VarKind } from "./types";

const POSITION_SYNONYMS: Record<string, Position> = {
  st: "ST",
  striker: "ST",
  strikers: "ST",
  forward: "ST",
  forwards: "ST",
  poacher: "ST",
  rw: "RW",
  "right wing": "RW",
  "right winger": "RW",
  winger: "RW",
  cam: "CAM",
  "attacking mid": "CAM",
  "attacking midfielder": "CAM",
  cm: "CM",
  midfielder: "CM",
  midfielders: "CM",
  cdm: "CDM",
  "defensive mid": "CDM",
  "defensive midfielder": "CDM",
  cb: "CB",
  "centre back": "CB",
  "center back": "CB",
  "centre-back": "CB",
  "center-back": "CB",
  "centre backs": "CB",
  defender: "CB",
  defenders: "CB",
};

const FINISH_SYNONYMS: Record<string, Finish> = {
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  totw: "totw",
  "in-form": "totw",
  inform: "totw",
  "in form": "totw",
  toty: "toty",
  "team of the year": "toty",
  icon: "icon",
  icons: "icon",
  founder: "founder",
  founders: "founder",
};

const STAT_SYNONYMS: Record<string, StatKey> = {
  pac: "pac",
  pace: "pac",
  speed: "pac",
  sho: "sho",
  shooting: "sho",
  shot: "sho",
  pas: "pas",
  passing: "pas",
  pass: "pas",
  dri: "dri",
  dribbling: "dri",
  dribble: "dri",
  def: "def",
  defending: "def",
  defense: "def",
  defence: "def",
  phy: "phy",
  physical: "phy",
  physique: "phy",
};

const LANGUAGE_HINTS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Lua",
  "Shell",
  "HTML",
  "CSS",
  "Dart",
  "Scala",
  "Haskell",
];

const ARCHETYPE_HINTS = [
  "Poacher",
  "Regista",
  "Libero",
  "Fantasista",
  "Target Man",
  "Mezzala",
  "Galáctico",
  "Galactico",
  "Founder",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ISO codes that collide with GitFut position abbreviations (ST/RW/CM/…).
 * Never treat these as country codes unless the full country name appears -
 * otherwise "top ST from Botswana" becomes Sao Tome (`st`).
 */
const POSITION_CODE_COLLISIONS = new Set(["st", "rw", "cam", "cm", "cdm", "cb"]);

/** Resolve a country name or code from free text; returns ISO-ish flag code. */
export function extractCountry(query: string): string | null {
  const q = normalize(query);

  // 1) Full country names only (longest first so "South Africa" beats "Africa").
  // Do NOT match bare ISO codes here - `st` in "top ST from …" is a position.
  const ranked = [...COUNTRIES].sort((a, b) => b.name.length - a.name.length);
  for (const c of ranked) {
    const name = normalize(c.name);
    if (name && q.includes(name)) return c.code;
  }

  // 2) Explicit "from/in <code>" for non-colliding codes (e.g. "from bw").
  const fromCode = q.match(/\b(?:from|in|of)\s+([a-z]{2,3})\b/);
  if (fromCode) {
    const tok = fromCode[1]!;
    if (!POSITION_CODE_COLLISIONS.has(tok)) {
      const hit = COUNTRIES.find((c) => c.code === tok);
      if (hit) return hit.code;
    }
  }

  // 3) Bare code token only when it isn't also a position abbreviation.
  const codeHit = q.match(/\b([a-z]{2,3})\b/g);
  if (codeHit) {
    for (const tok of codeHit) {
      if (POSITION_CODE_COLLISIONS.has(tok)) continue;
      const hit = COUNTRIES.find((c) => c.code === tok);
      if (hit) return hit.code;
    }
  }
  return null;
}

export function extractPosition(query: string): Position | null {
  const q = normalize(query);
  const ranked = Object.entries(POSITION_SYNONYMS).sort((a, b) => b[0].length - a[0].length);
  for (const [syn, pos] of ranked) {
    if (q.includes(syn)) return pos;
  }
  return null;
}

export function extractFinish(query: string): Finish | null {
  const q = normalize(query);
  const ranked = Object.entries(FINISH_SYNONYMS).sort((a, b) => b[0].length - a[0].length);
  for (const [syn, fin] of ranked) {
    if (q.includes(syn)) return fin;
  }
  return null;
}

export function extractStat(query: string): StatKey | null {
  const q = normalize(query);
  const ranked = Object.entries(STAT_SYNONYMS).sort((a, b) => b[0].length - a[0].length);
  for (const [syn, stat] of ranked) {
    if (q.includes(syn)) return stat;
  }
  return null;
}

export function extractLanguage(query: string): string | null {
  const q = normalize(query);
  const ranked = [...LANGUAGE_HINTS].sort((a, b) => b.length - a.length);
  for (const lang of ranked) {
    if (q.includes(normalize(lang))) return lang;
  }
  return null;
}

export function extractArchetype(query: string): string | null {
  const q = normalize(query);
  const ranked = [...ARCHETYPE_HINTS].sort((a, b) => b.length - a.length);
  for (const name of ranked) {
    if (q.includes(normalize(name))) return name === "Galactico" ? "Galáctico" : name;
  }
  return null;
}

export function extractByKind(kind: VarKind, query: string): string | null {
  switch (kind) {
    case "country":
      return extractCountry(query);
    case "position":
      return extractPosition(query);
    case "finish":
      return extractFinish(query);
    case "stat":
      return extractStat(query);
    case "language":
      return extractLanguage(query);
    case "archetype":
      return extractArchetype(query);
    case "family": {
      const q = normalize(query);
      if (q.includes("forward")) return "Forward";
      if (q.includes("playmaker")) return "Playmaker";
      if (q.includes("anchor")) return "Anchor";
      return null;
    }
    default:
      return null;
  }
}

export function extractVariables(
  query: string,
  variables: TemplateVariable[],
): { vars: Record<string, string>; missing: TemplateVariable[] } {
  const vars: Record<string, string> = {};
  const missing: TemplateVariable[] = [];
  for (const v of variables) {
    const val = extractByKind(v.kind, query);
    if (val) vars[v.name] = val;
    else if (v.required !== false) missing.push(v);
  }
  return { vars, missing };
}
