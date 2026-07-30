import { formatCount } from "../format";
import { t } from "../i18n/t";
import type { Locale } from "../i18n";
import type { Playstyle, Signals } from "./types";

// A predefined catalog of GitHub "playstyles". Each fires when its real signal
// crosses `base`; `plus` marks the elite "PlayStyle+" tier. A weak/empty profile
// crosses none, so it shows few or no playstyles — strength drives the count.
//
// Display strings (name + noun + plus suffix) live in the i18n dictionary;
// `key` here must exactly match a key in `dict/<locale>.ts playstyles`. The
// `PlaystyleKey` type below is enforced: adding `Foo` here without `Foo` in
// the dictionary is a compile error. Removing the entry from the dictionary
// without removing it here is also a compile error.

export type PlaystyleKey =
  | "Star Magnet"
  | "Viral Hit"
  | "Workhorse"
  | "Rapid Fire"
  | "Marathoner"
  | "Maintainer"
  | "Connector"
  | "Magnetic"
  | "Polyglot"
  | "Prolific"
  | "Veteran";

interface PlaystyleDef {
  key: PlaystyleKey;
  icon: string; // lucide icon key, resolved in the UI
  value: (s: Signals) => number;
  base: number;
  plus: number;
}

const CATALOG: PlaystyleDef[] = [
  { key: "Star Magnet", icon: "star", value: (s) => s.total_stars_owned, base: 500, plus: 20_000 },
  { key: "Viral Hit", icon: "flame", value: (s) => s.max_repo_stars, base: 1_000, plus: 20_000 },
  { key: "Workhorse", icon: "zap", value: (s) => s.active_days_recent, base: 120, plus: 250 },
  { key: "Rapid Fire", icon: "fast-forward", value: (s) => s.recent_contributions, base: 500, plus: 2_500 },
  { key: "Marathoner", icon: "infinity", value: (s) => s.total_contributions_lifetime, base: 3_000, plus: 25_000 },
  { key: "Maintainer", icon: "shield", value: (s) => s.reviews + s.issues_closed, base: 30, plus: 300 },
  { key: "Connector", icon: "git-pull-request", value: (s) => s.prs_to_others, base: 30, plus: 400 },
  { key: "Magnetic", icon: "users", value: (s) => s.followers, base: 200, plus: 20_000 },
  { key: "Polyglot", icon: "languages", value: (s) => s.languages, base: 5, plus: 9 },
  { key: "Prolific", icon: "folder-git", value: (s) => s.public_repos, base: 30, plus: 150 },
  { key: "Veteran", icon: "clock", value: (s) => s.account_age_years, base: 5, plus: 12 },
];

const MAX_SHOWN = 8;

// Returns the qualifying playstyles, PlayStyle+ first, then by how strongly the
// profile clears each base threshold; capped so the list stays readable.
export function derivePlaystyles(s: Signals, locale: Locale = "en"): Playstyle[] {
  return CATALOG.map((def) => ({ def, val: def.value(s) }))
    .filter(({ def, val }) => val >= def.base)
    .sort((a, b) => {
      const ap = a.val >= a.def.plus;
      const bp = b.val >= b.def.plus;
      if (ap !== bp) return ap ? -1 : 1;
      return b.val / b.def.base - a.val / a.def.base;
    })
    .slice(0, MAX_SHOWN)
    .map(({ def, val }) => {
      const dict = t.playstyle(def.key, locale);
      return {
        name: dict.name,
        icon: def.icon,
        plus: val >= def.plus,
        reason: `${formatCount(val)} ${dict.noun}${val >= def.plus ? dict.plusSuffix : ""}.`,
      };
    });
}
