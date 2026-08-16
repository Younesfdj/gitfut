import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlayerCard from "@/components/PlayerCard";
import { SAMPLE_CARDS } from "@/lib/github/samples";

describe("PlayerCard accessibility", () => {
  it.each([
    ["us", "United States"],
    ["sct", "Scotland"],
  ])("labels the %s flag with its country name", (country, expectedName) => {
    const html = renderToStaticMarkup(
      createElement(PlayerCard, {
        card: { ...SAMPLE_CARDS[0], country },
      }),
    );

    expect(html).toContain(`alt="${expectedName}"`);
  });
});
