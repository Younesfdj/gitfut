import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countryName, normalizeCountry, searchCountries } from "@/lib/countries";
import { WC26_TEAMS, flagPickerList, isQualifiedWC26, qualifiedFirst } from "@/lib/wc26";
import type { Confederation } from "@/lib/wc26";

// The team list is hand-written data, so the tests treat it as data: they check it
// against the two things that can silently break the picker — a code that isn't a
// real country, and a code with no flag PNG behind it (a card would render a
// broken image). Everything else here pins the ordering contract the picker relies on.

describe("WC26_TEAMS — the data", () => {
  it("has the 48 teams of the tournament", () => {
    expect(WC26_TEAMS).toHaveLength(48);
  });

  it("lists no team twice", () => {
    const codes = WC26_TEAMS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("splits into the real confederation quotas", () => {
    const count = (c: Confederation) => WC26_TEAMS.filter((t) => t.confederation === c).length;
    expect({
      AFC: count("AFC"),
      CAF: count("CAF"),
      CONCACAF: count("CONCACAF"),
      CONMEBOL: count("CONMEBOL"),
      OFC: count("OFC"),
      UEFA: count("UEFA"),
    }).toEqual({ AFC: 9, CAF: 10, CONCACAF: 6, CONMEBOL: 6, OFC: 1, UEFA: 16 });
  });

  // The list is keyed by OUR flag asset codes, not ISO — England and Scotland are
  // "eng"/"sct". A typo here is invisible until someone's flag silently vanishes.
  it("gives every team a code that resolves to a real country", () => {
    for (const { code } of WC26_TEAMS) {
      expect(normalizeCountry(code), code).toBe(code);
      expect(countryName(code), code).toBeTruthy();
    }
  });

  it("gives every team a flag asset that actually exists on disk", () => {
    for (const { code } of WC26_TEAMS) {
      const png = join(process.cwd(), "public", "badges", "flags", `${code}.png`);
      expect(existsSync(png), `missing flag asset for ${code}`).toBe(true);
    }
  });

  it("includes the three hosts and both play-off winners", () => {
    for (const code of ["ca", "mx", "us", "iq", "cd"]) {
      expect(isQualifiedWC26(code), code).toBe(true);
    }
  });

  it("carries the UK home nations under their non-ISO codes", () => {
    expect(countryName("eng")).toBe("England");
    expect(countryName("sct")).toBe("Scotland");
    expect(isQualifiedWC26("eng")).toBe(true);
    expect(isQualifiedWC26("sct")).toBe(true);
  });
});

describe("isQualifiedWC26", () => {
  it("is false for a country that didn't qualify", () => {
    expect(isQualifiedWC26("it")).toBe(false); // Italy missed out again
    expect(isQualifiedWC26("dk")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isQualifiedWC26("FR")).toBe(true);
    expect(isQualifiedWC26("Ma")).toBe(true);
  });

  it("is safe on empty / missing input", () => {
    expect(isQualifiedWC26("")).toBe(false);
    expect(isQualifiedWC26(null)).toBe(false);
    expect(isQualifiedWC26(undefined)).toBe(false);
  });
});

describe("qualifiedFirst", () => {
  const of = (...codes: string[]) => codes.map((code) => ({ code, name: code.toUpperCase() }));

  it("floats qualified teams above everyone else", () => {
    const { list } = qualifiedFirst(of("it", "fr", "dk", "br"));
    expect(list.map((c) => c.code)).toEqual(["fr", "br", "it", "dk"]);
  });

  it("reports the size of the qualified block", () => {
    expect(qualifiedFirst(of("it", "fr", "dk", "br")).qualifiedCount).toBe(2);
    expect(qualifiedFirst(of("it", "dk")).qualifiedCount).toBe(0);
  });

  // searchCountries already ranks prefix matches above substring ones; floating the
  // qualified block must not scramble that ranking WITHIN either group.
  it("preserves the incoming order inside each group", () => {
    const { list } = qualifiedFirst(of("dk", "br", "it", "fr"));
    expect(list.map((c) => c.code)).toEqual(["br", "fr", "dk", "it"]);
  });

  it("keeps the full country list intact, just reordered", () => {
    const all = searchCountries("");
    const { list, qualifiedCount } = qualifiedFirst(all);
    expect(list).toHaveLength(all.length);
    expect(qualifiedCount).toBe(48);
    expect(new Set(list.map((c) => c.code))).toEqual(new Set(all.map((c) => c.code)));
  });

  it("puts all 48 — and only those — in the leading block", () => {
    const { list, qualifiedCount } = qualifiedFirst(searchCountries(""));
    const lead = list.slice(0, qualifiedCount);
    expect(lead.every((c) => isQualifiedWC26(c.code))).toBe(true);
    expect(list.slice(qualifiedCount).some((c) => isQualifiedWC26(c.code))).toBe(false);
  });

  it("returns an empty result untouched", () => {
    expect(qualifiedFirst([])).toEqual({ list: [], qualifiedCount: 0 });
  });
});

describe("flagPickerList — what the picker actually renders", () => {
  it("leads the browse list with the 48, and flags the block size", () => {
    const { list, qualifiedCount } = flagPickerList("");
    expect(qualifiedCount).toBe(48);
    expect(list.slice(0, 48).every((c) => isQualifiedWC26(c.code))).toBe(true);
    // …and nothing is lost off the bottom.
    expect(list).toHaveLength(searchCountries("").length);
  });

  it("puts your national team first instead of 200 countries down", () => {
    const { list } = flagPickerList("");
    // Plain alphabetical would open on Afghanistan; now it opens on the tournament.
    expect(list[0].code).not.toBe("af");
    expect(isQualifiedWC26(list[0].code)).toBe(true);
  });

  // The regression this design exists to avoid: searchCountries deliberately ranks
  // prefix matches above substring ones. Floating the qualified teams THROUGH a
  // search would put Germany and Panama (substring, qualified) above Madagascar
  // (prefix) for "ma" — plainly wrong. A search is returned exactly as ranked.
  it("does not reorder a search, so prefix still beats substring", () => {
    const { list, qualifiedCount } = flagPickerList("ma");
    expect(list).toEqual(searchCountries("ma"));
    expect(list[0].name).toBe("Macao"); // not Morocco, not Germany
    expect(qualifiedCount).toBe(0); // → the picker draws no group headers
  });

  it("still ranks a searched-for qualified team on its own merits", () => {
    expect(flagPickerList("morocco").list[0].code).toBe("ma");
    expect(flagPickerList("fr").list[0].code).toBe("fr"); // exact code match
  });
});
