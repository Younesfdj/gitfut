import { describe, expect, it } from "vitest";
import { countryFromLocation } from "@/lib/geo";

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
