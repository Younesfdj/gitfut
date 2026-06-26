// Top-language → logo resolution. Pure, framework-agnostic (no DOM): given the
// owned-repo list, rank languages by how many repos use each as their primary,
// then resolve a logo from the open `programming-languages-logos` catalog,
// served by jsDelivr.
//
// The catalog is small — exactly these 18 slugs (from its src/languages.json) —
// so most GitHub languages (Rust, Shell, Dart, Vue, Jupyter Notebook…) have NO
// logo. GitHub also returns DISPLAY names ("C++", "C#") that don't equal slugs,
// hence the explicit name→slug map below; anything not in it has no logo and
// falls through to the next ranked language (see topLanguageLogo).

const CDN_BASE = "https://cdn.jsdelivr.net/npm/programming-languages-logos/src";

// GitHub primaryLanguage.name (lowercased) → catalog slug. ONLY the 18 catalog
// languages appear here (plus the "C++"/"C#" display-name aliases). Keep this
// list in sync with the catalog's src/languages.json.
export const LANGUAGE_SLUGS: Record<string, string> = {
  c: "c",
  "c++": "cpp",
  cpp: "cpp",
  "c#": "csharp",
  csharp: "csharp",
  css: "css",
  go: "go",
  haskell: "haskell",
  html: "html",
  java: "java",
  javascript: "javascript",
  kotlin: "kotlin",
  lua: "lua",
  php: "php",
  python: "python",
  r: "r",
  ruby: "ruby",
  swift: "swift",
  typescript: "typescript",
};

export interface LanguageLogo {
  name: string; // the GitHub language name this logo represents
  slug: string; // catalog slug
}

// Counts non-null primary languages and returns the names ordered by repo count
// (desc), with a deterministic name tie-break (asc) so the same profile always
// resolves to the same top language.
export function rankLanguages(repos: { language: string | null }[]): string[] {
  const counts = new Map<string, number>();
  for (const { language } of repos) {
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

// Case-insensitive lookup of a catalog slug for a GitHub language name.
export function logoSlugFor(name: string): string | null {
  return LANGUAGE_SLUGS[name.toLowerCase()] ?? null;
}

// Walks the ranked names and returns the first one with a catalog logo — so a
// Rust-then-TypeScript dev shows the TypeScript logo rather than nothing.
// Returns null only when none of their languages are in the catalog.
export function topLanguageLogo(rankedNames: string[]): LanguageLogo | null {
  for (const name of rankedNames) {
    const slug = logoSlugFor(name);
    if (slug) return { name, slug };
  }
  return null;
}

// jsDelivr URL for a catalog slug. PNG (not SVG): the catalog's PNGs are
// full-colour with transparent backgrounds and a solid logo body, so they read
// on the light card art — the SVGs are light/white fills that vanish on it.
export function languageLogoUrl(slug: string): string {
  return `${CDN_BASE}/${slug}/${slug}.png`;
}
