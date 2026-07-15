import { describe, expect, it } from "vitest";
import { cardDisplayName, getFitFontSize } from "@/lib/text";

// The on-card name size steps down with displayName.length (uppercase DINPro-CondBold).
// These thresholds are shared between the live PlayerCard, html-to-image export, and
// the Satori render (lib/og/renderCard.tsx); we test the contract here so a tweak in
// one place can't silently desync the others.
describe("getFitFontSize", () => {
  it("keeps the base 13cqw for short names that comfortably fit the band", () => {
    expect(getFitFontSize("YOUNESFDJ")).toBe(13); // 8 chars
    expect(getFitFontSize("LINUS")).toBe(13); // 5 chars
    expect(getFitFontSize("ABCDEFGHIJ")).toBe(13); // 10 chars (boundary)
  });

  it("steps down at each length threshold so longer names stay inside ~83% of card width", () => {
    expect(getFitFontSize("ABCDEFGHIJKLM")).toBe(11.5); // 13 chars (boundary)
    expect(getFitFontSize("ABCDEFGHIJKLMNOP")).toBe(10); // 16 chars (boundary)
    expect(getFitFontSize("ABCDEFGHIJKLMNOPQRS")).toBe(9); // 19 chars (boundary)
  });

  it("keeps stepping down for very long names but never below the readable floor", () => {
    expect(getFitFontSize("VERYLONGGAMERTAGHERE")).toBe(8.2); // 22 chars (boundary)
    expect(getFitFontSize("ABSURDLYSUPERLONGLOGINSHOULDNTHAPPENBUT")).toBe(7.5); // >22 chars
  });

  it("is monotonically non-increasing as length grows", () => {
    const sizes = [
      getFitFontSize("A"),
      getFitFontSize("AB"),
      getFitFontSize("ABCDEFGHIJ"),
      getFitFontSize("ABCDEFGHIJKLM"),
      getFitFontSize("ABCDEFGHIJKLMNOP"),
      getFitFontSize("ABCDEFGHIJKLMNOPQRS"),
      getFitFontSize("ABCDEFGHIJKLMNOPQRSTUV"),
      getFitFontSize("ABCDEFGHIJKLMNOPQRSTUVWXYZABCD"),
    ];
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    }
  });
});

// cardDisplayName is already covered indirectly via the share/engine/duel tests;
// we keep one regression test here so changes to the helper are caught next to
// getFitFontSize (its main downstream consumer).
describe("cardDisplayName", () => {
  it("collapses to the surname when it's short enough (and the full name is not in band)", () => {
    expect(cardDisplayName("Linus Torvalds")).toBe("Torvalds");
  });

  it("leaves single-token oversize names verbatim (no spaces to split on)", () => {
    // The whole name is one big token so the helper returns it unchanged.
    expect(cardDisplayName("reallylongsinglewordusernameforthelongtestcase")).toBe(
      "reallylongsinglewordusernameforthelongtestcase",
    );
  });

  it("collapses to the first name when the surname is too long or has too many words", () => {
    expect(cardDisplayName("Younes Ferradji Teffahi")).toBe("Younes"); // surname too long
  });

  it("falls back to the joined surname when it's short enough", () => {
    // surname must be <= MAX_SURNAME_CHARS (13) chars including spaces
    expect(cardDisplayName("Ada Smith Doe")).toBe("Smith Doe"); // 9 chars
  });
});
