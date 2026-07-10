export const CARD_IMAGE_WIDTHS = {
  small: 360,
  medium: 810,
  large: 1080,
} as const;

export type CardImageSize = keyof typeof CARD_IMAGE_WIDTHS;

export function cardImageWidthForSize(size: string | null | undefined): number {
  const key = size?.toLowerCase() as CardImageSize | undefined;
  return key && key in CARD_IMAGE_WIDTHS ? CARD_IMAGE_WIDTHS[key] : CARD_IMAGE_WIDTHS.medium;
}

export function cardImageHeightForWidth(width: number): number {
  return Math.round((width * 820) / 540);
}
