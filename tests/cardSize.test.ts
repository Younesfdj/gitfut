import { describe, expect, it } from "vitest";
import { CARD_IMAGE_WIDTHS, cardImageHeightForWidth, cardImageWidthForSize } from "@/lib/og/cardSize";

describe("card image size variants", () => {
  it("maps the three public size variants to fixed render widths", () => {
    expect(CARD_IMAGE_WIDTHS).toEqual({ small: 360, medium: 810, large: 1080 });
    expect(cardImageWidthForSize("small")).toBe(CARD_IMAGE_WIDTHS.small);
    expect(cardImageWidthForSize("medium")).toBe(CARD_IMAGE_WIDTHS.medium);
    expect(cardImageWidthForSize("large")).toBe(CARD_IMAGE_WIDTHS.large);
  });

  it("keeps medium as the default for missing or unknown size params", () => {
    expect(cardImageWidthForSize(null)).toBe(CARD_IMAGE_WIDTHS.medium);
    expect(cardImageWidthForSize("")).toBe(CARD_IMAGE_WIDTHS.medium);
    expect(cardImageWidthForSize("tiny")).toBe(CARD_IMAGE_WIDTHS.medium);
  });

  it("accepts size params case-insensitively", () => {
    expect(cardImageWidthForSize("SMALL")).toBe(CARD_IMAGE_WIDTHS.small);
    expect(cardImageWidthForSize("Large")).toBe(CARD_IMAGE_WIDTHS.large);
  });

  it("derives image height from the FUT card aspect ratio", () => {
    expect(cardImageHeightForWidth(360)).toBe(547);
    expect(cardImageHeightForWidth(810)).toBe(1230);
    expect(cardImageHeightForWidth(1080)).toBe(1640);
  });
});
