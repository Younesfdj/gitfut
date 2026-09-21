import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  countryName,
  isValidCountry,
  normalizeCountry,
  searchCountries,
} from "@/lib/countries";

// The picker can only ever offer a country we ship a flag for, so these guard
// the data contract (no pseudo-flags, no 404s) and the search behaviour the UI
// relies on — not the rendering.

describe("country data", () => {
  it("ships a non-trivial, alphabetically-sorted list", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
    const names = COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "en"))).toEqual(names);
  });

  it("uses lowercase 2–3 letter codes with no duplicates", () => {
    const codes = COUNTRIES.map((c) => c.code);
    for (const code of codes) expect(code).toMatch(/^[a-z]{2,3}$/); // 3-letter = UK home nations
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("excludes supranational and sub-region pseudo-flags", () => {
    const codes = new Set(COUNTRIES.map((c) => c.code));
    expect(codes.has("eu")).toBe(false);
    expect(codes.has("an")).toBe(false);
    expect([...codes].some((c) => c.includes("-"))).toBe(false);
  });
});

describe("isValidCountry / normalizeCountry", () => {
  it("accepts known codes case-insensitively", () => {
    expect(isValidCountry("us")).toBe(true);
    expect(isValidCountry("US")).toBe(true);
    expect(normalizeCountry("US")).toBe("us");
  });

  it("rejects unknown, empty, and nullish input", () => {
    for (const bad of ["zz", "eu", "", "  ", null, undefined]) {
      expect(isValidCountry(bad)).toBe(false);
      expect(normalizeCountry(bad)).toBeNull();
    }
  });
});

describe("countryName", () => {
  it("resolves names case-insensitively, null for unknown", () => {
    expect(countryName("gb")).toBe("United Kingdom");
    expect(countryName("DE")).toBe("Germany");
    expect(countryName("zz")).toBeNull();
    expect(countryName(null)).toBeNull();
  });
});

describe("UK home nations", () => {
  it("are valid, named flag codes (so a derived flag survives normalization)", () => {
    for (const [code, name] of [
      ["sct", "Scotland"],
      ["wls", "Wales"],
      ["eng", "England"],
      ["nir", "Northern Ireland"],
    ] as const) {
      expect(isValidCountry(code)).toBe(true);
      expect(normalizeCountry(code.toUpperCase())).toBe(code);
      expect(countryName(code)).toBe(name);
    }
  });

  it("are pickable and searchable like any country", () => {
    const codes = new Set(searchCountries("").map((c) => c.code));
    for (const code of ["sct", "wls", "eng", "nir"]) expect(codes.has(code)).toBe(true);
    expect(codes.has("gb")).toBe(true); // sovereign UK is still there too
    expect(searchCountries("scot")[0]?.code).toBe("sct"); // found by name
  });
});

describe("searchCountries", () => {
  it("returns the full list for an empty query", () => {
    expect(searchCountries("")).toBe(COUNTRIES);
    expect(searchCountries("   ")).toBe(COUNTRIES);
  });

  it("ranks prefix matches above substring matches", () => {
    const res = searchCountries("ge");
    const names = res.map((c) => c.name);
    // Germany & Georgia (prefix) should precede Algeria (substring "ge" in -ge-).
    expect(names.indexOf("Germany")).toBeLessThan(names.indexOf("Algeria"));
    expect(names.indexOf("Georgia")).toBeLessThan(names.indexOf("Algeria"));
  });

  it("matches on code as well as name", () => {
    const res = searchCountries("jp");
    expect(res[0]?.code).toBe("jp");
    expect(res[0]?.name).toBe("Japan");
  });

  it("returns empty for a query that matches nothing", () => {
    expect(searchCountries("qqqq")).toEqual([]);
  });

  // Renamed countries (issue #85): current names display, retired names still search.
  it("shows current names for renamed countries and keeps the old names findable", () => {
    expect(countryName("mk")).toBe("North Macedonia");
    expect(countryName("sz")).toBe("Eswatini");
    // "macedonia" matches the new name by substring; "swaziland" only via alias.
    expect(searchCountries("macedonia").map((c) => c.code)).toContain("mk");
    expect(searchCountries("swaziland").map((c) => c.code)).toContain("sz");
    expect(searchCountries("swazi")[0]?.code).toBe("sz");
    // The alias is search-only — no result ever displays the retired name.
    for (const c of searchCountries("swaziland")) expect(c.name).not.toBe("Swaziland");
  });
});
