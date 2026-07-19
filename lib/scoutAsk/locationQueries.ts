import { countryName } from "@/lib/countries";

/**
 * GitHub `location:` search terms for a flag code (country name + major cities).
 *
 * IMPORTANT: GitHub user search does NOT allow `location:A OR location:B`.
 * OR only applies to free text, not qualifiers - that query returns HTTP 422
 * and zero results. Callers must search each term in a separate request and merge.
 */
const EXTRA_TERMS: Record<string, string[]> = {
  bw: ["Botswana", "Gaborone", "Francistown", "Maun"],
  za: ["South Africa", "Johannesburg", "Cape Town", "Pretoria", "Durban"],
  ng: ["Nigeria", "Lagos", "Abuja", "Ibadan"],
  ke: ["Kenya", "Nairobi", "Mombasa"],
  gh: ["Ghana", "Accra", "Kumasi"],
  eg: ["Egypt", "Cairo", "Alexandria"],
  us: ["United States", "USA", "San Francisco", "New York", "Seattle"],
  gb: ["United Kingdom", "UK", "London"],
  eng: ["England", "London", "Manchester"],
  in: ["India", "Bangalore", "Bengaluru", "Mumbai", "Hyderabad"],
  de: ["Germany", "Berlin", "Munich"],
  br: ["Brazil", "Brasil", "São Paulo", "Sao Paulo"],
};

/** Location strings to search for a country (city terms first, then country name). */
export function locationTermsForCountry(countryCode: string): string[] {
  const code = countryCode.toLowerCase();
  const name = countryName(code);
  const extras = EXTRA_TERMS[code] ?? [];
  // Cities before country name so local profiles aren't buried under nationwide
  // high-follower accounts when results are merged.
  const cities = extras.filter((t) => !name || t.toLowerCase() !== name.toLowerCase());
  const ordered = [...cities, ...(name ? [name] : []), ...extras.filter((t) => name && t.toLowerCase() === name.toLowerCase())];
  return [...new Set(ordered)];
}

/** Single-term GitHub search qualifier. Multi-word places need quotes. */
export function githubLocationQualifier(term: string): string {
  const t = term.trim();
  if (!t) return "location:unknown";
  return /\s/.test(t) ? `location:"${t}"` : `location:${t}`;
}

/** @deprecated Invalid on GitHub - OR cannot join location qualifiers. Use per-term search. */
export function githubLocationQuery(countryCode: string): string {
  return locationTermsForCountry(countryCode).map(githubLocationQualifier).join(" OR ");
}
