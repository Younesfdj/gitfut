// Top-language → logo resolution. Pure, framework-agnostic (no DOM): given the
// owned-repo list, rank languages by how many repos use each as their primary,
// then resolve a colored logo from Devicon (https://devicon.dev), served by
// jsDelivr — ~150 languages, far more than the old 18-icon catalog (so Rust, Go,
// Vue, Dart, Elixir… all resolve now).
//
// IMPORTANT: GitHub's `primaryLanguage` is the *byte-largest* language per repo,
// so a TypeScript/Python project with a big bundled/generated CSS or HTML file is
// reported as CSS/HTML. We DEMOTE styling/markup/data/prose languages so the
// card's headline goes to a real programming language (see NON_HEADLINE).
//
// Devicon uses `<dir>/<dir>-<variant>.svg`. We store the full icon id (e.g.
// "rust-original") and derive the dir from its first segment. Variant is usually
// "-original" (full colour); Go uses "-original-wordmark" (the "Go" word, not the
// gopher). GitHub display names that differ from Devicon dirs are mapped below.

const CDN_BASE = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

// Per-language logo overrides, for two cases: (1) Devicon draws it in a style that
// clashes with the card art — notably C, whose `c-original` is a beveled teal badge
// that reads as a muddy blob over the player photo; and (2) Devicon has no icon at
// all — like ReScript. Keyed by our slug → full logo URL on any CDN that serves a
// clean, full-colour, transparent asset. Add a language here when Devicon's icon
// looks bad or is missing.
const LOGO_URL_OVERRIDES: Record<string, string> = {
  "c-original": "https://cdn.jsdelivr.net/npm/programming-languages-logos/src/c/c.png",
  // Devicon has no ReScript icon; use Material Icon Theme's (the coral ReScript mark).
  rescript: "https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme/icons/rescript.svg",
};

// GitHub primaryLanguage.name (lowercased) → Devicon icon id ("<dir>-<variant>").
// Anything not here has no logo and resolves to null (the name still shows).
export const LANGUAGE_SLUGS: Record<string, string> = {
  javascript: "javascript-original",
  typescript: "typescript-original",
  python: "python-original",
  java: "java-original",
  c: "c-original",
  "c++": "cplusplus-original",
  cpp: "cplusplus-original",
  "c#": "csharp-original",
  csharp: "csharp-original",
  go: "go-original-wordmark", // the "Go" word, not the gopher
  rust: "rust-original",
  ruby: "ruby-original",
  php: "php-original",
  swift: "swift-original",
  kotlin: "kotlin-original",
  dart: "dart-original",
  scala: "scala-original",
  elixir: "elixir-original",
  haskell: "haskell-original",
  lua: "lua-original",
  r: "r-original",
  shell: "bash-original",
  vue: "vuejs-original",
  svelte: "svelte-original",
  html: "html5-original",
  css: "css3-original",
  scss: "sass-original",
  sass: "sass-original",
  clojure: "clojure-original",
  erlang: "erlang-original",
  perl: "perl-original",
  "objective-c": "objectivec-plain",
  zig: "zig-original",
  julia: "julia-original",
  ocaml: "ocaml-original",
  powershell: "powershell-original",
  dockerfile: "docker-original",
  "jupyter notebook": "jupyter-original",
  crystal: "crystal-original",
  solidity: "solidity-original",
  nim: "nim-original",
  rescript: "rescript", // override-only (Devicon lacks it) — see LOGO_URL_OVERRIDES

  // Where a language's canonical mark IS its tool, we use the tool's icon: Emacs
  // Lisp → Emacs, Vim Script → Vim, GDScript → Godot, HCL → Terraform, PL/pgSQL
  // → Postgres. That's the logo those communities actually recognise.
  astro: "astro-original",
  apex: "apex-original",
  arduino: "arduino-original",
  awk: "awk-original",
  clojurescript: "clojurescript-original",
  cmake: "cmake-original",
  cobol: "cobol-original",
  coffeescript: "coffeescript-original",
  delphi: "delphi-original",
  elm: "elm-original",
  "emacs lisp": "emacs-original",
  "f#": "fsharp-original",
  fsharp: "fsharp-original",
  fortran: "fortran-original",
  gdscript: "godot-original",
  gleam: "gleam-original",
  graphql: "graphql-plain", // Devicon ships no "-original" for GraphQL
  groovy: "groovy-original",
  handlebars: "handlebars-original",
  haxe: "haxe-original",
  hcl: "terraform-original", // GitHub reports Terraform files as HCL
  mathematica: "wolfram-original",
  matlab: "matlab-original",
  nix: "nixos-original",
  plpgsql: "postgresql-original",
  processing: "processing-original",
  prolog: "prolog-original",
  purescript: "purescript-original",
  racket: "racket-original",
  terraform: "terraform-original",
  tex: "tex-original",
  tsql: "microsoftsqlserver-plain",
  vala: "vala-original",
  vba: "visualbasic-original",
  "vim script": "vim-original",
  "vim snippet": "vim-original",
  "visual basic": "visualbasic-original",
  "visual basic .net": "visualbasic-original",
  webassembly: "wasm-original",
};

// Styling / markup / prose / data / config languages (lowercased). These inflate
// by bytes but aren't a developer's "headline" language, so they're ranked below
// any real programming language. A dev with ONLY these still shows their top one.
const NON_HEADLINE = new Set([
  // styling
  "css", "scss", "sass", "less", "stylus", "postcss",
  // markup / templates
  "html", "xml", "svg", "pug", "haml", "ejs", "handlebars", "mustache", "liquid",
  // prose
  "markdown", "mdx", "tex",
  // data
  "json", "yaml", "toml", "csv", "ini",
  // build / config
  "dockerfile", "makefile", "cmake",
]);

// A "headline" language is a real programming language (anything not in the
// styling/markup/data/prose demotion set above).
export const isHeadlineLanguage = (name: string): boolean => !NON_HEADLINE.has(name.toLowerCase());

export interface LanguageLogo {
  name: string; // the GitHub language name this logo represents
  slug: string; // Devicon icon id ("<dir>-<variant>")
}

// Counts non-null primary languages and orders them by repo count (desc) with a
// deterministic name tie-break (asc), THEN floats headline (programming)
// languages above styling/markup/data — so a repo mislabeled "CSS" by GitHub
// can't headline a TypeScript/Python developer's card.
export function rankLanguages(repos: { language: string | null }[]): string[] {
  const counts = new Map<string, number>();
  for (const { language } of repos) {
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return [
    ...sorted.filter(([name]) => isHeadlineLanguage(name)),
    ...sorted.filter(([name]) => !isHeadlineLanguage(name)),
  ].map(([name]) => name);
}

// Case-insensitive lookup of a Devicon icon id for a GitHub language name.
export function logoSlugFor(name: string): string | null {
  return LANGUAGE_SLUGS[name.toLowerCase()] ?? null;
}

// The logo for the HEADLINE language only (rankedNames[0]) — never a different
// language's icon. This keeps the logo in sync with the displayed top language:
// a Rust-#1 dev shows the Rust logo, and a language Devicon lacks shows no logo
// (the name still appears) rather than a mismatched icon.
export function topLanguageLogo(rankedNames: string[]): LanguageLogo | null {
  const top = rankedNames[0];
  const slug = top ? logoSlugFor(top) : null;
  return slug ? { name: top, slug } : null;
}

// jsDelivr URL for a Devicon icon id. The dir is the id's first segment
// ("rust-original" → icons/rust/rust-original.svg). Colored SVG (Devicon's
// `-original` variants keep the brand colours, so they read on the card art).
export function languageLogoUrl(slug: string): string {
  return LOGO_URL_OVERRIDES[slug] ?? `${CDN_BASE}/${slug.split("-")[0]}/${slug}.svg`;
}
