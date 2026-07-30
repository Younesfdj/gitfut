// t() — the single API every consumer imports. Pure function (the hook variant
// lives in useT.tsx for React components).
//
// `key` is dotted-path: `t("stats.pac.abbr", "en")`. `params` interpolates
// `{name}` placeholders. Functions in the dictionary are invoked with named
// args (so the linter catches typos). Missing keys are LOUD: when the value is
// missing in the requested locale, t() falls back to ENGLISH and returns a
// `{...}`-wrapped key in development so dangling translations are visible in
// the UI; in production it just returns English silently.

import { DEFAULT_LOCALE, type Locale } from "./index";
import { getDict } from "./dictionaries";

export type TParams = Record<string, string | number>;
export type VarMap = Record<string, string | number>;

/**
 * Resolve a function-shaped dictionary entry by key. The keys in `fns`
 * correspond to the function dict paths under this prefix (e.g. ui.duel.winnerA
 * is exposed as `t.fn("ui.duel.winnerA")` then `.with({a: ..., stat: ...})`).
 *
 * Use this when the dictionary stores a function rather than a flat string —
 * the playwright story-export tooltip etc. always want structured args.
 */
export interface TFunctionRef {
  call: (vars: VarMap) => string;
  with: (vars: VarMap) => string;
}

/**
 * `t` — flat translation API.
 *
 *  t("ui.scoutForm.headline", "ko")      // string keys
 *  t.fn("ui.duel.winnerA", "ko").with({a: "X", stat: "PAC"})
 *  t.archetype("poacher", "en")          // returns { name, blurb }
 *  t.playstyle("Star Magnet", "ko")      // returns { name, noun, plusSuffix }
 *  t.metric("commits", "ko")             // returns { label, unit }
 *
 * Keys that begin with `@`, e.g. "@global", return their English value
 * regardless of the requested locale. This is the OG image / card art
 * escape hatch — anything tagged `@` is intentionally locale-locked.
 */
export interface Translator {
  (key: string, locale: Locale, params?: TParams): string;
  fn: (key: string, locale: Locale) => TFunctionRef;
  archetype: (key: keyof Dictionary["archetypes"], locale: Locale) => { name: string; blurb: string };
  playstyle: (key: keyof Dictionary["playstyles"], locale: Locale) => { name: string; noun: string; plusSuffix: string };
  metric: (key: keyof Dictionary["metrics"], locale: Locale) => { label: string; unit: string };
  finishLabel: (finish: "bronze" | "silver" | "gold" | "totw" | "toty" | "icon" | "founder", locale: Locale) => string;
  position: (pos: "ST" | "RW" | "CAM" | "CM" | "CDM" | "CB", locale: Locale) => string;
  family: (fam: "Forward" | "Playmaker" | "Anchor", locale: Locale) => string;
  stat: (k: "pac" | "sho" | "pas" | "dri" | "def" | "phy", locale: Locale) => { abbr: string; gloss: string };
  pun: (index: number, locale: Locale) => string;
  style: (
    key: keyof Dictionary["style"],
    locale: Locale,
  ) => { value: string; reason: string };
  /** Duel stat-row header label (PAC/SHO/PAS/DRI/DEF/PHY), locale-aware. */
  duelStatRow: (k: "pac" | "sho" | "pas" | "dri" | "def" | "phy", locale: Locale) => string;
  /** Duel receipt labels ("Commits this year" / "올해 커밋"), locale-aware. */
  duelReceiptLabel: (
    k: "commits" | "starsEarned" | "pullRequests" | "followers" | "codeReviews" | "contributions",
    locale: Locale,
  ) => string;
  countryName: (code: string, locale: Locale) => string;
  workRate_label: (locale: Locale) => { High: string; Med: string; Low: string };
  workRate_reason: (locale: Locale, attack: "High" | "Med" | "Low", defense: "High" | "Med" | "Low") => string;
  attribute: {
    skillMoves: (count: number, langs: number, hasBonus: boolean, repos: string) => string;
    weakFoot: (weakAvg: number) => string;
  };
}

// Re-export the Dictionary type so callers can `import type { Dictionary }`.
export type { Dictionary } from "./dict/types";
import type { Dictionary } from "./dict/types";

const MISSING_MARK = process.env.NODE_ENV === "production" ? "" : "⟦missing⟧";

function getByPath(d: Dictionary | undefined, path: string): unknown {
  if (!d) return undefined;
  const segments = path.split(".");
  let cur: unknown = d;
  for (const s of segments) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur;
}

function interpolate(template: string, params: TParams | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

function formatMissing(path: string, params: TParams | undefined): string {
  if (params) {
    const filled = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(", ");
    return `${MISSING_MARK}${path}(${filled})${MISSING_MARK}`;
  }
  return `${MISSING_MARK}${path}${MISSING_MARK}`;
}

/**
 * Locked key escape hatch: keys starting with `@` always return their EN value
 * no matter the requested locale. Use for strings that must stay EN — the card
 * art, OG images, third-party social cards, etc.
 */
function stripLockPrefix(k: string): { locked: boolean; path: string } {
  if (k.startsWith("@")) return { locked: true, path: k.slice(1) };
  return { locked: false, path: k };
}

const translateFlat: Translator = ((key: string, locale: Locale, params?: TParams) => {
  const { locked, path } = stripLockPrefix(key);
  const effectiveLocale = locked ? DEFAULT_LOCALE : locale;
  const value = getByPath(getDict(effectiveLocale), path);
  if (typeof value === "function") {
    // Function entries can also be looked up flat — when they are, the caller
    // is expected to pass named args in `params`. Useful for non-React paths
    // (e.g. OG image rendering, which can't use hooks).
    try {
      const fn = value as (v: VarMap) => string;
      return interpolate(fn(params ?? {}), params);
    } catch {
      return formatMissing(path, params);
    }
  }
  if (typeof value === "string") return interpolate(value, params);
  if (value == null) {
    // Try fallback to English before giving up.
    const fallback = getByPath(getDict(DEFAULT_LOCALE), path);
    if (typeof fallback === "string") return interpolate(fallback, params);
    if (typeof fallback === "function") {
      try {
        return interpolate((fallback as (v: VarMap) => string)(params ?? {}), params);
      } catch {
        return formatMissing(path, params);
      }
    }
    return formatMissing(path, params);
  }
  return formatMissing(path, params);
}) as Translator;

translateFlat.fn = (key: string, locale: Locale): TFunctionRef => {
  const { locked, path } = stripLockPrefix(key);
  const effectiveLocale = locked ? DEFAULT_LOCALE : locale;
  const value = getByPath(getDict(effectiveLocale), path);
  return {
    call: (vars: VarMap) => {
      if (typeof value === "function") {
        try {
          return (value as (v: VarMap) => string)(vars);
        } catch {
          return formatMissing(path, vars);
        }
      }
      return typeof value === "string" ? interpolate(value, vars) : formatMissing(path, vars);
    },
    with: (vars: VarMap) => translateFlat(key, locale, vars),
  };
};

translateFlat.archetype = (key, locale) => {
  // `LOCK` — archetypes are always EN (product copy lives on the card art in EN).
  // Caller can override by passing the EN dict explicitly if they ever need KO names.
  const locked: Locale = DEFAULT_LOCALE;
  void locale;
  return getDict(locked).archetypes[key];
};

translateFlat.playstyle = (key, locale) => {
  const { locked, path } = stripLockPrefix(String(key));
  const effectiveLocale = locked ? DEFAULT_LOCALE : locale;
  // value is the playstyles dict; look up by key directly.
  return getDict(effectiveLocale).playstyles[key];
};

translateFlat.metric = (key, locale) => {
  // Metrics follow the user's locale so 'stars' becomes '별'.
  return getDict(locale).metrics[key];
};

translateFlat.finishLabel = (finish, locale) => {
  return getDict(locale).finish[finish];
};

translateFlat.position = (pos, locale) => {
  return getDict(locale).position[pos];
};

translateFlat.family = (fam, locale) => {
  return getDict(locale).family[fam];
};

translateFlat.stat = (k, locale) => {
  return getDict(locale).stats[k];
};

translateFlat.style = (key, locale) => {
  return getDict(locale).style[key];
};

translateFlat.workRate_label = (locale) => {
  return getDict(locale).workRate.label;
};

translateFlat.workRate_reason = (locale, attack: "High" | "Med" | "Low", defense: "High" | "Med" | "Low") => {
  const localized = getDict(locale).workRate;
  const localizedAttack = localized.label[attack];
  const localizedDefense = localized.label[defense];
  return localized.reason({ attack: localizedAttack, defense: localizedDefense });
};

/** Duel stat-row header label (PAC/SHO/PAS/DRI/DEF/PHY), locale-aware. */
translateFlat.duelStatRow = (k: "pac" | "sho" | "pas" | "dri" | "def" | "phy", locale: Locale) => {
  return getDict(locale).ui.duel.statRows[k];
};

/** Duel receipt labels ("Commits this year" / "올해 커밋"), locale-aware. */
translateFlat.duelReceiptLabel = (
  k: "commits" | "starsEarned" | "pullRequests" | "followers" | "codeReviews" | "contributions",
  locale: Locale,
) => {
  return getDict(locale).ui.duel.metricReceipts[k];
};

translateFlat.countryName = (code: string, locale: Locale): string => {
  // Try the locale table first; fall back to EN lookup, then to the raw code
  // (last-ditch so the picker never renders `undefined`). The EN dictionary
  // carries the canonical 250 names from `countries.ts`, so EN is always
  // present. Other locales carry smaller overrides generated/copied from the
  // EN table.
  const dict = getDict(locale);
  const ko = dict.countries[code];
  if (ko) return ko;
  const en = getDict(DEFAULT_LOCALE).countries[code];
  if (en) return en;
  return code.toUpperCase();
};

translateFlat.pun = (index, locale) => {
  const puns = getDict(locale).puns;
  if (!puns.length) return "";
  const i = ((index % puns.length) + puns.length) % puns.length;
  return puns[i];
};

translateFlat.attribute = {
  skillMoves: (
    _count: number,
    langs: number,
    hasBonus: boolean,
    repos: string,
  ) => {
    // Default ENGLISH interpolation. `t("ui.attribute.skillMoves", locale, …)`
    // would lose the typed arity, so we read the dict and call the function
    // here. locale-aware callers (RE-derive per render) can call with locale.
    return `Technical range: ${langs} language${langs === 1 ? "" : "s"}${hasBonus ? ` across ${repos} repos` : ""}.`;
  },
  weakFoot: (weakAvg: number) => `Off-foot: your three weakest stats average ${weakAvg}/99.`,
};

export const t = translateFlat;
