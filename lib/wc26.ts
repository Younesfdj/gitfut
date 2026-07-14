import { type Country, searchCountries } from "./countries";

// The 48 teams qualified for the 2026 World Cup, keyed by the flag asset code we
// already ship (public/badges/flags/<code>.png). This is the whole point of the
// picker change: gitfut is a World-Cup-26 app, but the flag list is a flat ISO
// dump of ~250 countries, so finding your national team means scrolling past 200
// that aren't in the tournament.
//
// Codes are OUR flag keys, not ISO: England and Scotland are "eng"/"sct" (see
// UK_NATIONS in countries.ts), which is exactly the kind of thing a hand-written
// list gets wrong — so a test asserts every code below resolves to a real country
// AND a real flag asset.
//
// Includes the three hosts (Canada, Mexico, USA) and the two inter-confederation
// play-off winners (Iraq, DR Congo).

export type Confederation = "AFC" | "CAF" | "CONCACAF" | "CONMEBOL" | "OFC" | "UEFA";

export interface QualifiedTeam {
  code: string; // flag asset key, lowercase
  confederation: Confederation;
}

export const WC26_TEAMS: readonly QualifiedTeam[] = [
  // AFC (9)
  { code: "au", confederation: "AFC" },
  { code: "ir", confederation: "AFC" },
  { code: "iq", confederation: "AFC" }, // inter-confederation play-off winner
  { code: "jp", confederation: "AFC" },
  { code: "jo", confederation: "AFC" },
  { code: "qa", confederation: "AFC" },
  { code: "sa", confederation: "AFC" },
  { code: "kr", confederation: "AFC" },
  { code: "uz", confederation: "AFC" },
  // CAF (10)
  { code: "dz", confederation: "CAF" },
  { code: "cv", confederation: "CAF" },
  { code: "cd", confederation: "CAF" }, // inter-confederation play-off winner
  { code: "eg", confederation: "CAF" },
  { code: "gh", confederation: "CAF" },
  { code: "ci", confederation: "CAF" },
  { code: "ma", confederation: "CAF" },
  { code: "sn", confederation: "CAF" },
  { code: "za", confederation: "CAF" },
  { code: "tn", confederation: "CAF" },
  // CONCACAF (6)
  { code: "ca", confederation: "CONCACAF" }, // host
  { code: "cw", confederation: "CONCACAF" },
  { code: "ht", confederation: "CONCACAF" },
  { code: "mx", confederation: "CONCACAF" }, // host
  { code: "pa", confederation: "CONCACAF" },
  { code: "us", confederation: "CONCACAF" }, // host
  // CONMEBOL (6)
  { code: "ar", confederation: "CONMEBOL" },
  { code: "br", confederation: "CONMEBOL" },
  { code: "co", confederation: "CONMEBOL" },
  { code: "ec", confederation: "CONMEBOL" },
  { code: "py", confederation: "CONMEBOL" },
  { code: "uy", confederation: "CONMEBOL" },
  // OFC (1)
  { code: "nz", confederation: "OFC" },
  // UEFA (16)
  { code: "at", confederation: "UEFA" },
  { code: "be", confederation: "UEFA" },
  { code: "ba", confederation: "UEFA" },
  { code: "hr", confederation: "UEFA" },
  { code: "cz", confederation: "UEFA" },
  { code: "eng", confederation: "UEFA" },
  { code: "fr", confederation: "UEFA" },
  { code: "de", confederation: "UEFA" },
  { code: "nl", confederation: "UEFA" },
  { code: "no", confederation: "UEFA" },
  { code: "pt", confederation: "UEFA" },
  { code: "sct", confederation: "UEFA" },
  { code: "es", confederation: "UEFA" },
  { code: "se", confederation: "UEFA" },
  { code: "ch", confederation: "UEFA" },
  { code: "tr", confederation: "UEFA" },
];

const QUALIFIED = new Set(WC26_TEAMS.map((t) => t.code));

/** True when `code` is one of the 48 teams at the 2026 World Cup. Case-insensitive. */
export function isQualifiedWC26(code: string | null | undefined): boolean {
  return !!code && QUALIFIED.has(code.toLowerCase());
}

/**
 * Floats the World-Cup-26 teams to the top of a country list, keeping each group
 * in the order it came in — so the caller's own ranking (searchCountries already
 * ranks prefix matches above substring ones) still holds WITHIN each group.
 *
 * Returns a FLAT list plus the size of the qualified block, deliberately: the
 * picker's keyboard navigation and aria-activedescendant address options by
 * index, so grouping has to stay a rendering concern, not a data-shape one.
 */
export function qualifiedFirst(countries: readonly Country[]): {
  list: readonly Country[];
  qualifiedCount: number;
} {
  const qualified: Country[] = [];
  const rest: Country[] = [];
  for (const c of countries) (isQualifiedWC26(c.code) ? qualified : rest).push(c);
  return { list: [...qualified, ...rest], qualifiedCount: qualified.length };
}

/**
 * The flag picker's list, and the size of its leading World-Cup block (0 = show no
 * group headers).
 *
 * The regrouping applies to the BROWSE case only. While the user is searching,
 * searchCountries' prefix-over-substring ranking is what they're steering, and
 * floating the qualified teams through it would fight that: "ma" would surface
 * Germany and Panama (substring, qualified) above Madagascar (prefix), which is
 * plainly the wrong answer. So a search is returned exactly as ranked, and only
 * the full list gets the World-Cup block — which is where the win actually is:
 * your national team is at the top instead of 200 countries down.
 */
export function flagPickerList(query: string): {
  list: readonly Country[];
  qualifiedCount: number;
} {
  const matches = searchCountries(query);
  return query.trim() ? { list: matches, qualifiedCount: 0 } : qualifiedFirst(matches);
}
