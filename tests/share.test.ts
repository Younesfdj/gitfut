import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/scoring/types";
import { cardUrl, intentUrl, nativeSharePayload, shareMessage, shareText } from "@/lib/share";

// We test the share DECISIONS: correct platform endpoints, well-formed encoded
// URLs, stable per-login text, brag-led message. Not the React wiring.

const card = (over: Partial<Card> = {}): Card =>
  ({
    login: "torvalds",
    name: "Linus Torvalds",
    avatarUrl: "https://example.com/a.png",
    country: "us",
    club: "legends",
    stats: { pac: 74, sho: 97, pas: 90, dri: 69, def: 65, phy: 96 },
    position: "ST",
    family: "Forward",
    baseOVR: 88,
    overall: 95,
    finish: "icon",
    finishLabel: "ICON",
    archetype: "Galáctico",
    archetypeBlurb: "hall-of-fame maintainer",
    legacy: { L: 1 },
    report: {
      skillMoves: 3,
      weakFoot: 4,
      workRate: { attack: "High", defense: "Med" },
      style: "Relentless",
      reasons: { skillMoves: "", weakFoot: "", workRate: "", style: "" },
      playstyles: [],
      metrics: [],
    },
    ...over,
  }) as Card;

describe("share service", () => {
  it("builds the canonical card URL from the login, encoding the displayed flag", () => {
    const c = card();
    expect(cardUrl(c, undefined, c.name)).toBe("https://gitfut.com/torvalds?country=us");
  });

  it("omits the country param when the card has no flag", () => {
    const c = card({ country: "" });
    expect(cardUrl(c, undefined, c.name)).toBe("https://gitfut.com/torvalds");
  });

  it("includes name param in the URL when the name is overridden", () => {
    const c = card({ name: "Custom Name" });
    expect(cardUrl(c, undefined, "Linus Torvalds")).toBe("https://gitfut.com/torvalds?country=us&name=Custom+Name");
  });

  it("X intent uses /intent/tweet (NOT /intent/post) and carries url + hashtag", () => {
    const c = card();
    const u = intentUrl("x", c, undefined, c.name);
    expect(u).toContain("https://twitter.com/intent/tweet?");
    expect(u).not.toContain("/intent/post");
    expect(u).toContain("hashtags=GitFut");
    expect(u).toContain(encodeURIComponent("https://gitfut.com/torvalds?country=us"));
  });

  it("LinkedIn intent uses share-offsite with only the url (preview from OG)", () => {
    const c = card();
    const u = intentUrl("linkedin", c, undefined, c.name);
    expect(u).toContain("linkedin.com/sharing/share-offsite/?url=");
    expect(u).toContain(encodeURIComponent("https://gitfut.com/torvalds?country=us"));
  });

  it("WhatsApp intent puts text + url in the message", () => {
    const c = card();
    const u = intentUrl("whatsapp", c, undefined, c.name);
    expect(u).toContain("api.whatsapp.com/send?text=");
    expect(decodeURIComponent(u)).toContain("gitfut.com/torvalds?country=us");
  });

  it("share text is deterministic per login and mentions the rating", () => {
    const a = shareText(card());
    const b = shareText(card());
    expect(a).toBe(b);
    expect(a).toContain("95");
  });

  it("different logins can select different lines", () => {
    const a = shareText(card({ login: "torvalds" }));
    const b = shareText(card({ login: "sindresorhus" }));
    // both are valid lines; at least one should differ across a sample of logins
    const c = shareText(card({ login: "gaearon" }));
    expect(new Set([a, b, c]).size).toBeGreaterThan(1);
  });

  it("native payload carries title, brag-led text, and url", () => {
    const c = card();
    const p = nativeSharePayload(c, undefined, c.name);
    expect(p.title).toBe("GitFut");
    expect(p.url).toBe("https://gitfut.com/torvalds?country=us");
    expect(p.text).toBe(shareMessage(card()));
    expect(p.text).toContain("get scouted");
  });

  it("share message is the text plus the CTA", () => {
    expect(shareMessage(card())).toContain(shareText(card()));
  });
});
