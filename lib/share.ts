import type { Card } from "@/lib/scoring/types";

// Share service — a pure module that, given a card, produces the share text and
// per-platform intent URLs. No DOM, no side effects; the React layer wires the
// gestures (native share sheet, window.open). Tested in isolation.

export type SharePlatform = "x" | "linkedin" | "whatsapp";

const SITE = "https://gitfut.com";

// Deterministic line per login (FNV-1a) so a given user always gets the same
// brag — leads with the flex, leaves room for the user's own comment.
const lines = (c: Card): string[] => [
  `apparently i'm a ${c.overall}-rated ${c.position}. my commits do numbers, my cardio does not.`,
  `${c.finishLabel.toLowerCase()} finish, ${c.overall} overall. peaked, and it was on github.`,
  `pulled a ${c.overall} overall off my github. open source national team, where you at.`,
  `${c.overall} overall ${c.position}, ${c.archetype}. built different, deployed different.`,
  `got carded at ${c.overall} overall. the scouts (nobody) are calling.`,
  `turns out shipping code makes you a ${c.overall}-rated baller. who knew.`,
];

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Encode the displayed flag in the share link so the recipient's card matches
// what the sharer saw (the page re-applies it; an absent/invalid code just
// falls back to the GitHub-derived default).
export function cardUrl(card: Card): string {
  const base = `${SITE}/${card.login}`;
  return card.country ? `${base}?country=${encodeURIComponent(card.country)}` : base;
}

export function shareText(card: Card): string {
  const pool = lines(card);
  return pool[hash(card.login) % pool.length];
}

// Full sentence used as the native-share payload / pre-filled tweet body.
export function shareMessage(card: Card): string {
  return `${shareText(card)}\n\nget scouted →`;
}

// X (Twitter) web-intent composer — the single source for the tweet string.
// Uses /intent/tweet (NOT /intent/post — the latter loops on mobile); carries
// the prefilled body, the url, and the hashtag.
const tweetIntent = (text: string, url: string): string =>
  "https://twitter.com/intent/tweet?text=" +
  encodeURIComponent(text) +
  "&url=" +
  encodeURIComponent(url) +
  "&hashtags=GitFut";

// Per-platform intent URLs. LinkedIn honors only the url; its preview comes from
// OG tags.
export function intentUrl(platform: SharePlatform, card: Card): string {
  const url = cardUrl(card);
  const text = shareMessage(card);
  switch (platform) {
    case "x":
      return tweetIntent(text, url);
    case "linkedin":
      return (
        "https://www.linkedin.com/sharing/share-offsite/?url=" +
        encodeURIComponent(url)
      );
    case "whatsapp":
      return (
        "https://api.whatsapp.com/send?text=" +
        encodeURIComponent(`${text} ${url}`)
      );
  }
}

// Native Web Share API payload (text + url; file added at call site for IG).
export function nativeSharePayload(card: Card): { title: string; text: string; url: string } {
  return {
    title: "GitFut",
    text: shareMessage(card),
    url: cardUrl(card),
  };
}

// Kept for backward-compat with any existing import.
export function shareUrl(card: Card): string {
  return intentUrl("x", card);
}

// ---- Duel sharing ----
// Score-free by design: the fixture poster never spoils the Result, and the
// default share text protects the same click ("full-time score inside").
// Sharers who want to brag the score type it themselves.

export function duelUrl(challenger: string, opponent: string): string {
  return `${SITE}/${challenger}/vs/${opponent}`;
}

const duelLines = (opponent: string): string[] => [
  `just dragged @${opponent} onto the pitch. full-time score inside.`,
  `me vs @${opponent}, settled on github stats. someone got cooked.`,
  `called out @${opponent} for a duel. the scoreline does the talking.`,
  `six stats, no VAR. me vs @${opponent} — result inside.`,
];

export function duelShareMessage(challenger: string, opponent: string): string {
  const pool = duelLines(opponent);
  return `${pool[hash(`${challenger}/${opponent}`) % pool.length]}\n\nwatch the duel →`;
}

export function duelIntentUrl(challenger: string, opponent: string): string {
  return tweetIntent(duelShareMessage(challenger, opponent), duelUrl(challenger, opponent));
}

export function duelSharePayload(
  challenger: string,
  opponent: string,
): { title: string; text: string; url: string } {
  return {
    title: "GitFut Duel",
    text: duelShareMessage(challenger, opponent),
    url: duelUrl(challenger, opponent),
  };
}
