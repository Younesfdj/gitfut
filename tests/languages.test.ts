import { describe, expect, it } from "vitest";
import { languageLogoUrl, logoSlugFor, rankLanguages, topLanguageLogo } from "@/lib/github/languages";

// We test the language DECISIONS: deterministic ranking with markup demotion, the
// GitHub-name→Devicon-id map (incl. display names + the Go wordmark), and that the
// logo always matches the headline language (no fall-through to a different icon).

const repos = (...langs: (string | null)[]) => langs.map((language) => ({ language }));

describe("rankLanguages", () => {
  it("orders by repo count, descending", () => {
    expect(rankLanguages(repos("Go", "TypeScript", "TypeScript", "TypeScript", "Go"))).toEqual([
      "TypeScript",
      "Go",
    ]);
  });

  it("breaks count ties by name, ascending (deterministic)", () => {
    expect(rankLanguages(repos("Ruby", "Go", "Python"))).toEqual(["Go", "Python", "Ruby"]);
  });

  it("ignores repos with no primary language", () => {
    expect(rankLanguages(repos("Rust", null, "Rust", null))).toEqual(["Rust"]);
  });

  it("demotes styling/markup below real programming languages", () => {
    // GitHub reports a byte-heavy repo as CSS; Python should still headline.
    expect(
      rankLanguages(repos("CSS", "CSS", "CSS", "CSS", "Python", "Python", "Python", "HTML")),
    ).toEqual(["Python", "CSS", "HTML"]);
  });

  it("keeps styling languages when there's no programming language", () => {
    expect(rankLanguages(repos("CSS", "CSS", "HTML"))).toEqual(["CSS", "HTML"]);
  });

  it("returns an empty list when there are no languages", () => {
    expect(rankLanguages(repos(null, null))).toEqual([]);
    expect(rankLanguages([])).toEqual([]);
  });
});

describe("logoSlugFor", () => {
  it("maps languages to Devicon ids, case-insensitively", () => {
    expect(logoSlugFor("TypeScript")).toBe("typescript-original");
    expect(logoSlugFor("python")).toBe("python-original");
    expect(logoSlugFor("Rust")).toBe("rust-original"); // covered now (was a catalog miss)
  });

  it("maps GitHub display names to Devicon dirs", () => {
    expect(logoSlugFor("C++")).toBe("cplusplus-original");
    expect(logoSlugFor("C#")).toBe("csharp-original");
  });

  it("uses the Go wordmark (not the gopher)", () => {
    expect(logoSlugFor("Go")).toBe("go-original-wordmark");
  });

  it("returns null for languages Devicon doesn't cover", () => {
    for (const name of ["Fortran", "COBOL", "Brainfuck"]) {
      expect(logoSlugFor(name)).toBeNull();
    }
  });
});

describe("topLanguageLogo", () => {
  it("returns the headline language's own logo", () => {
    expect(topLanguageLogo(["TypeScript", "Rust"])).toEqual({ name: "TypeScript", slug: "typescript-original" });
    expect(topLanguageLogo(["Rust", "TypeScript"])).toEqual({ name: "Rust", slug: "rust-original" });
  });

  it("does NOT fall back — a top language Devicon lacks gets no logo", () => {
    expect(topLanguageLogo(["Fortran", "TypeScript"])).toBeNull();
  });

  it("uses a styling logo only when there's no programming language", () => {
    expect(topLanguageLogo(["CSS", "HTML"])).toEqual({ name: "CSS", slug: "css3-original" });
  });

  it("returns null for an empty list", () => {
    expect(topLanguageLogo([])).toBeNull();
  });
});

describe("languageLogoUrl", () => {
  it("builds the Devicon jsDelivr SVG path (dir = first segment)", () => {
    expect(languageLogoUrl("go-original-wordmark")).toBe(
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original-wordmark.svg",
    );
    expect(languageLogoUrl("cplusplus-original")).toBe(
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg",
    );
  });

  it("overrides C to the flat catalog (Devicon's c-original clashes with the card)", () => {
    expect(languageLogoUrl("c-original")).toBe(
      "https://cdn.jsdelivr.net/npm/programming-languages-logos/src/c/c.png",
    );
  });
});

describe("ReScript (Devicon lacks it — overridden to Material Icon Theme)", () => {
  it("resolves the slug and headlines its own logo", () => {
    expect(logoSlugFor("ReScript")).toBe("rescript");
    expect(topLanguageLogo(["ReScript", "TypeScript"])).toEqual({ name: "ReScript", slug: "rescript" });
  });

  it("ranks above styling languages like any real language", () => {
    expect(rankLanguages(repos("CSS", "CSS", "ReScript"))).toEqual(["ReScript", "CSS"]);
  });

  it("points at a real, full-colour logo URL", () => {
    expect(languageLogoUrl("rescript")).toBe(
      "https://cdn.jsdelivr.net/gh/PKief/vscode-material-icon-theme/icons/rescript.svg",
    );
  });
});
