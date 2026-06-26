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
