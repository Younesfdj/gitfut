import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  countryName,
  isValidCountry,
  normalizeCountry,
  searchCountries,
} from "./countries";

// The picker can only ever offer a country we ship a flag for, so these guard
// the data contract (no pseudo-flags, no 404s) and the search behaviour the UI
// relies on — not the rendering.

describe("country data", () => {
  it("ships a non-trivial, alphabetically-sorted list", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
    const names = COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "en"))).toEqual(names);
  });

  it("uses lowercase alpha-2 codes with no duplicates", () => {
    const codes = COUNTRIES.map((c) => c.code);
    for (const code of codes) expect(code).toMatch(/^[a-z]{2}$/);
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
});
