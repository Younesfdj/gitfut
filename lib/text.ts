// Display-text helpers. The scoring engine's archetype blurbs use em dashes;
// our copy style bans them. We sanitize at the display layer (not in the engine)
// so the data stays untouched and the rendered copy stays on-brand.

// " — " → ": " for the first break (reads as a definition), then ", " for any
// remaining breaks. Also handles the "--" ASCII variant.
export function deEmDash(input: string): string {
  let seen = false;
  return input
    .replace(/\s*(—|--)\s*/g, () => {
      if (!seen) {
        seen = true;
        return ": ";
      }
      return ", ";
    })
    .trim();
}

const MAX_SURNAME_CHARS = 13;
const MAX_SURNAME_WORDS = 3;

export function cardDisplayName(name: string): string {
  const full = name.trim();
  if (full.length <= 9) return full;
  const [first, ...rest] = full.split(/\s+/);
  if (rest.length === 0) return full;
  const surname = rest.join(" ");
  const tooBig =
    surname.length > MAX_SURNAME_CHARS || rest.length > MAX_SURNAME_WORDS;
  return tooBig ? first : surname;
}

// Length-aware font size (in cqw of the card width) for the on-card display name.
// The base 13cqw size fits ~10-12 uppercase DINPro-CondBold chars; longer names
// overflow the visible card band, so we step the size down by string length and
// cap the visible band at ~90% of the card width (the under-name separator spans
// 16.67% → 83.33%, so the text sits inside that range).
//
// We pass the *already uppercased* display name (the live card and the OG render
// both uppercase before measuring). Satori has no DOM to measure, so this pure
// helper is shared between both rendering paths and keeps them visually identical.
export function getFitFontSize(displayName: string): number {
  const len = displayName.length;
  if (len <= 10) return 13;
  if (len <= 13) return 11.5;
  if (len <= 16) return 10;
  if (len <= 19) return 9;
  if (len <= 22) return 8.2;
  return 7.5;
}
