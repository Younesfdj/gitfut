import { describe, expect, it } from "vitest";
import { formatCount, round1, round2 } from "@/lib/format";

// formatCount feeds the card, the scout report and the duel bars, so the exact
// strings matter: they have to stay short enough for the fixed-width slots and
// never show a four-digit thousands value like "1200k".

describe("formatCount", () => {
  it("prints small counts verbatim", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(7)).toBe("7");
    expect(formatCount(999)).toBe("999");
  });

  it("switches to thousands at 1000", () => {
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1240)).toBe("1.2k");
    expect(formatCount(9999)).toBe("10k");
  });

  it("drops the decimal once there are ten or more thousands", () => {
    expect(formatCount(10000)).toBe("10k");
    expect(formatCount(248723)).toBe("249k");
  });

  it("switches to millions instead of a four-digit thousands value", () => {
    // Top accounts clear a million stars once organization-owned repos count,
    // and "1200k" is neither compact nor readable.
    expect(formatCount(1_000_000)).toBe("1M");
    expect(formatCount(1_250_000)).toBe("1.3M");
    expect(formatCount(12_300_000)).toBe("12M");
  });

  it("rolls over rather than rounding up to 1000k", () => {
    expect(formatCount(999_999)).toBe("1M");
  });
});

describe("round1 / round2", () => {
  it("rounds to fixed precision", () => {
    expect(round2(1.005)).toBe(1);
    expect(round2(1.239)).toBe(1.24);
    expect(round1(1.24)).toBe(1.2);
    expect(round1(1.25)).toBe(1.3);
  });

  it("is stable for values already at precision", () => {
    expect(round2(2.5)).toBe(2.5);
    expect(round1(2.5)).toBe(2.5);
  });
});
