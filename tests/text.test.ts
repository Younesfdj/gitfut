import { describe, expect, it } from "vitest";
import { cardDisplayName, deEmDash } from "@/lib/text";

// Both helpers run at the display layer on every card. deEmDash rewrites the
// archetype blurb (card + OG image); cardDisplayName decides which part of a name
// fits on the card — and it exists *because* of a shipped bug (#48, two-word
// surnames vanishing), so these tests pin that fix in place and nail the length /
// word-count boundaries where the next off-by-one would hide.

describe("deEmDash", () => {
  it("turns the first em-dash break into a colon (reads as a definition)", () => {
    expect(deEmDash("the magician — a polyglot working across many stacks")).toBe(
      "the magician: a polyglot working across many stacks",
    );
  });

  it("turns later breaks into commas, keeping the first as a colon", () => {
    expect(deEmDash("engine — box-to-box — daily driver")).toBe("engine: box-to-box, daily driver");
  });

  it("handles the ASCII '--' variant the same way", () => {
    expect(deEmDash("deep playmaker -- coordinates from the back")).toBe(
      "deep playmaker: coordinates from the back",
    );
  });

  it("normalises the spacing around a dash (none, or lots)", () => {
    expect(deEmDash("a—b")).toBe("a: b");
    expect(deEmDash("a   —   b")).toBe("a: b");
  });

  it("leaves dash-free text untouched", () => {
    expect(deEmDash("a prolific shipper whose output lands")).toBe("a prolific shipper whose output lands");
  });

  it("trims the result", () => {
    expect(deEmDash("  hello world  ")).toBe("hello world");
  });

  it("returns an empty string unchanged", () => {
    expect(deEmDash("")).toBe("");
  });
});

describe("cardDisplayName", () => {
  it("shows a short name (≤ 9 chars) in full", () => {
    expect(cardDisplayName("Linus")).toBe("Linus");
    expect(cardDisplayName("Torvalds")).toBe("Torvalds"); // 8 chars, single word
  });

  it("drops the first name and shows the surname when the full name is long", () => {
    expect(cardDisplayName("Linus Torvalds")).toBe("Torvalds");
    expect(cardDisplayName("The Octocat")).toBe("Octocat");
  });

  // The #48 regression: a two-word surname used to vanish. It must show in full.
  it("keeps a multi-word surname that fits (the #48 fix)", () => {
    expect(cardDisplayName("Guido van Rossum")).toBe("van Rossum");
    expect(cardDisplayName("Ada de Lovelace")).toBe("de Lovelace");
  });

  it("falls back to the first name when the surname is too long (> 13 chars)", () => {
    expect(cardDisplayName("John Featherstonehaugh")).toBe("John"); // surname 17 chars
  });

  it("falls back to the first name when the surname runs to too many words (> 3)", () => {
    // surname "bb cc dd ee" is only 11 chars, so it's the WORD count (4 > 3) that
    // trips the fallback, not the char limit — isolating that branch.
    expect(cardDisplayName("Aa bb cc dd ee")).toBe("Aa");
  });

  it("keeps a single long word whole — there's nothing to trim to", () => {
    expect(cardDisplayName("Supercalifragilistic")).toBe("Supercalifragilistic");
  });

  it("normalises surrounding and inner whitespace", () => {
    expect(cardDisplayName("  Linus   Torvalds  ")).toBe("Torvalds");
  });

  it("returns empty / blank input as an empty string", () => {
    expect(cardDisplayName("")).toBe("");
    expect(cardDisplayName("    ")).toBe("");
  });

  describe("boundaries", () => {
    it("keeps the full name at exactly 9 chars, trims at 10", () => {
      expect(cardDisplayName("Ab Cdefgh")).toBe("Ab Cdefgh"); // 9 chars → full
      expect(cardDisplayName("Abc Cdefgh")).toBe("Cdefgh"); // 10 chars → surname
    });

    it("keeps a 13-char surname, drops to the first name at 14", () => {
      expect(cardDisplayName("X aaaaaaaaaaaaa")).toBe("aaaaaaaaaaaaa"); // surname 13 → kept
      expect(cardDisplayName("X aaaaaaaaaaaaaa")).toBe("X"); // surname 14 → first name
    });

    it("keeps a 3-word surname, drops to the first name at 4 words", () => {
      expect(cardDisplayName("a bb cc dd")).toBe("bb cc dd"); // 3 words → kept
      expect(cardDisplayName("a bb cc dd ee")).toBe("a"); // 4 words → first name
    });
  });
});
