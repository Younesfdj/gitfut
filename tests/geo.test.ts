import { describe, expect, it } from "vitest";
import { countryForLogin, countryFromLocation } from "@/lib/geo";

// The UK home nations are separate football sides, so a Scottish/Welsh/etc.
// profile should fly its own flag instead of being collapsed onto the Union Flag.
describe("countryFromLocation — UK home nations", () => {
  it("resolves each home nation to its own flag code", () => {
    expect(countryFromLocation("Scotland")).toBe("sct");
    expect(countryFromLocation("Wales")).toBe("wls");
    expect(countryFromLocation("England")).toBe("eng");
    expect(countryFromLocation("Northern Ireland")).toBe("nir");
  });

  it("resolves home-nation cities to the right nation", () => {
    expect(countryFromLocation("Edinburgh")).toBe("sct");
    expect(countryFromLocation("Glasgow, Scotland")).toBe("sct");
    expect(countryFromLocation("Cardiff")).toBe("wls");
    expect(countryFromLocation("Belfast")).toBe("nir");
    expect(countryFromLocation("London")).toBe("eng");
    expect(countryFromLocation("Manchester, UK")).toBe("eng"); // city segment wins over the UK segment
  });

  it("keeps UK-wide terms on the Union Flag", () => {
    for (const t of ["United Kingdom", "UK", "Britain", "Great Britain"]) {
      expect(countryFromLocation(t)).toBe("gb");
    }
  });

  it("leaves non-UK locations unchanged", () => {
    expect(countryFromLocation("France")).toBe("fr");
    expect(countryFromLocation("San Francisco")).toBe("us");
    expect(countryFromLocation("Berlin, Germany")).toBe("de");
    expect(countryFromLocation("Texas")).toBe("us");
    expect(countryFromLocation("nowhere-ville")).toBeNull();
  });
});

// "Georgia" is both the country and a US state; a bare name reads as the country,
// and only reads as the US state when the location also points at the US.
describe("countryFromLocation — Georgia (country vs US state)", () => {
  it("reads an unqualified 'Georgia' as the country", () => {
    expect(countryFromLocation("Georgia")).toBe("ge");
    expect(countryFromLocation("Tbilisi, Georgia")).toBe("ge");
    expect(countryFromLocation("Georgia 🇬🇪")).toBe("ge");
    expect(countryFromLocation("Georgia, Europe")).toBe("ge");
  });

  it("reads it as the US state when the location points at the US", () => {
    expect(countryFromLocation("Georgia, USA")).toBe("us");
    expect(countryFromLocation("Georgia, United States")).toBe("us");
    expect(countryFromLocation("Atlanta, Georgia")).toBe("us");
    expect(countryFromLocation("Georgia, Atlanta")).toBe("us"); // US city in a later segment
  });

  it("still resolves other US states to the US", () => {
    expect(countryFromLocation("Texas")).toBe("us");
    expect(countryFromLocation("Ohio, USA")).toBe("us");
  });
});

// The deliberate design decisions the module's own header calls out — a wrong
// guess is worse than no flag, so these are contracts, not incidental behaviour.
describe("countryFromLocation — what it deliberately refuses", () => {
  it("skips ambiguous 2-letter abbreviations rather than guessing", () => {
    // "DE" is Germany or Delaware, "CA" California or Canada — the module leaves
    // both unresolved on purpose (see its header comment).
    expect(countryFromLocation("DE")).toBeNull();
    expect(countryFromLocation("CA")).toBeNull();
  });

  it("still honours the intentional 'uk' alias (not every 2-letter is dropped)", () => {
    expect(countryFromLocation("uk")).toBe("gb");
  });

  it("returns null for empty, blank, or symbol-only input", () => {
    expect(countryFromLocation(null)).toBeNull();
    expect(countryFromLocation(undefined)).toBeNull();
    expect(countryFromLocation("")).toBeNull();
    expect(countryFromLocation("   ")).toBeNull();
    expect(countryFromLocation("123 !!!")).toBeNull(); // stripped to nothing
    expect(countryFromLocation("nowhere-ville")).toBeNull();
  });
});

describe("countryFromLocation — aliases, accents, and phrases", () => {
  it("resolves native-language and colloquial country names", () => {
    expect(countryFromLocation("Deutschland")).toBe("de");
    expect(countryFromLocation("España")).toBe("es");
    expect(countryFromLocation("Türkiye")).toBe("tr");
    expect(countryFromLocation("Holland")).toBe("nl");
  });

  it("resolves accented city names", () => {
    expect(countryFromLocation("München")).toBe("de");
    expect(countryFromLocation("Kraków")).toBe("pl");
  });

  it("resolves non-US cities to their own country", () => {
    expect(countryFromLocation("Tokyo")).toBe("jp");
    expect(countryFromLocation("Amsterdam")).toBe("nl");
    expect(countryFromLocation("Toronto")).toBe("ca");
  });

  it("matches a multi-word term embedded anywhere in the string", () => {
    // No comma to split on — the phrase is found inside the free text.
    expect(countryFromLocation("currently based in United Kingdom")).toBe("gb");
    expect(countryFromLocation("remote — the netherlands")).toBe("nl");
  });

  it("takes the first resolving segment, left to right", () => {
    // A US state in the first segment wins before "France" is ever considered.
    expect(countryFromLocation("California, France")).toBe("us");
  });
});

// countryForLogin is what engine.ts actually calls to set a card's country, and
// it had no tests. It layers a pinned-origin override over countryFromLocation.
describe("countryForLogin", () => {
  it("uses the pinned origin for showcased accounts, ignoring their location", () => {
    expect(countryForLogin("torvalds", null)).toBe("us");
    expect(countryForLogin("t3dotgg", "somewhere")).toBe("us");
    expect(countryForLogin("pewdiepie-archdaemon", null)).toBe("se");
  });

  it("matches the pinned login case-insensitively, and the pin wins over location", () => {
    expect(countryForLogin("Torvalds", "France")).toBe("us"); // not "fr"
  });

  it("falls back to the location for everyone else", () => {
    expect(countryForLogin("some-user", "Berlin, Germany")).toBe("de");
  });

  it("returns null when a non-pinned account has no resolvable location", () => {
    expect(countryForLogin("some-user", null)).toBeNull();
    expect(countryForLogin("some-user", "nowhere-ville")).toBeNull();
  });
});
