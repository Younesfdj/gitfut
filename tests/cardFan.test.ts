import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import CardFan from "@/components/CardFan";
import { SAMPLE_CARDS } from "@/lib/github/samples";

describe("CardFan", () => {
  it("renders every sample card as a keyboard-focusable button", () => {
    const cards = SAMPLE_CARDS.slice(0, 2);
    const html = renderToStaticMarkup(
      createElement(CardFan, { cards, onPick: vi.fn() }),
    );

    expect(html.match(/<button/g)).toHaveLength(cards.length);
    expect(html).toContain('type="button"');

    for (const card of cards) {
      expect(html).toContain(
        `aria-label="Scout ${card.name ?? card.login}"`,
      );
    }
  });
});
