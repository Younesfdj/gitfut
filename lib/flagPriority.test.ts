import { describe, expect, it } from "vitest";
import { needsIpFallback, pickFlag } from "./flagPriority";

// The flag-priority contract: override → GitHub → IP, each validated against the
// shipped flag set. This is the behavioural heart of the new report-edit flow.

describe("pickFlag", () => {
  it("prefers a valid override above everything", () => {
    expect(pickFlag("fr", "us", "de")).toBe("fr");
    expect(pickFlag("FR", "us", "de")).toBe("fr"); // normalised
  });

  it("falls back to GitHub country when there's no override", () => {
    expect(pickFlag(null, "us", "de")).toBe("us");
    expect(pickFlag("", "us", "de")).toBe("us");
  });

  it("falls back to IP only when override and GitHub are both empty", () => {
    expect(pickFlag(null, "", "de")).toBe("de");
    expect(pickFlag(undefined, null, "de")).toBe("de");
  });

  it("skips invalid values at each level rather than emitting them", () => {
    // invalid override → use GitHub
    expect(pickFlag("zz", "us", "de")).toBe("us");
    // invalid override + invalid GitHub → use IP
    expect(pickFlag("zz", "eu", "de")).toBe("de");
    // everything invalid → null (no flag)
    expect(pickFlag("zz", "eu", "xx")).toBeNull();
  });

  it("returns null when nothing is provided", () => {
    expect(pickFlag(null, null, null)).toBeNull();
  });
});

describe("needsIpFallback", () => {
  it("is true only when neither override nor GitHub yields a valid flag", () => {
    expect(needsIpFallback(null, "")).toBe(true);
    expect(needsIpFallback("zz", "eu")).toBe(true); // both invalid
  });

  it("is false when an override or GitHub flag is present and valid", () => {
    expect(needsIpFallback("fr", "")).toBe(false);
    expect(needsIpFallback(null, "us")).toBe(false);
  });
});
