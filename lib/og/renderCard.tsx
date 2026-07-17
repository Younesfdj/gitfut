import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Card, StatKey } from "@/lib/scoring/types";
import { resolveCardTheme } from "@/components/finishTheme";
import { languageLogoUrl } from "@/lib/github/languages";
import { cardDisplayName, getFitFontSize } from "@/lib/text";
import { loadCardFonts } from "./card";

// Server-side re-creation of the in-app PlayerCard (components/PlayerCard.tsx),
// used both for the embeddable /<user>.png AND as the hero of the social unfurl
// (opengraph-image). Rendered with Satori (next/og); the layout IS PlayerCard —
// percentage x/y positions verbatim, cqw font sizes resolved to px at the chosen
// width (1cqw = 1% of card width), so the same card scales by passing a different
// W. Satori can't do CSS mask-image, so the avatar's feather is baked into the PNG
// with sharp (see avatarDataUri); everything else matches the live card.

const EMBED_W = 810; // /<user>.png render width (540 native × 1.5 for crispness)
const cardH = (w: number) => Math.round((w * 820) / 540); // native 540×820 aspect

const pad2 = (n: number) => String(Math.round(n)).padStart(2, "0");

// Silhouette fallback (identical to PlayerCard's) so the photo slot is never empty.
const AVATAR_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="%23000" fill-opacity="0"/><circle cx="160" cy="128" r="62" fill="%23ffffff" fill-opacity="0.18"/><rect x="58" y="206" width="204" height="150" rx="80" fill="%23ffffff" fill-opacity="0.18"/></svg>',
  );

// value/label cells, copied verbatim from PlayerCard (vx/lx/vy/ly are % of the card).
const STAT_CELLS: { k: StatKey; l: string; vx: number; lx: number; vy: number; ly: number }[] = [
  { k: "pac", l: "PAC", vx: 21.3, lx: 32.41, vy: 64.63, ly: 65.24 },
  { k: "dri", l: "DRI", vx: 56.48, lx: 67.59, vy: 64.63, ly: 65.24 },
  { k: "sho", l: "SHO", vx: 21.3, lx: 32.41, vy: 72.2, ly: 72.8 },
  { k: "def", l: "DEF", vx: 56.48, lx: 67.59, vy: 72.2, ly: 72.8 },
  { k: "pas", l: "PAS", vx: 21.3, lx: 32.41, vy: 79.76, ly: 80.37 },
  { k: "phy", l: "PHY", vx: 56.48, lx: 67.59, vy: 79.76, ly: 80.37 },
];

// Separator lines PIL draws over the blank card art. [left%, top%, width%].
const H_LINES: [number, number, number][] = [
  [19.44, 31.1, 10.19],
  [19.44, 40.85, 10.19],
  [16.67, 64.02, 66.67],
  [44.44, 89.63, 11.11],
];

const publicFile = (rel: string) => join(process.cwd(), "public", rel.replace(/^\//, ""));

async function fileDataUri(absPath: string, mime: string): Promise<string | null> {
  try {
    const buf = await readFile(absPath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function fetchBytes(url: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return { buf: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type")?.split(";")[0] || "image/png" };
  } catch {
    return null;
  }
}

async function fetchDataUri(url: string): Promise<string | null> {
  const r = await fetchBytes(url);
  return r ? `data:${r.mime};base64,${r.buf.toString("base64")}` : null;
}

// Falls back to the raw photo (then the silhouette) if sharp or the fetch fails.
async function avatarDataUri(url: string, bw: number, bh: number): Promise<string> {
  const r = await fetchBytes(url);
  if (!r) {
    console.error("[renderCard] avatar fetch failed:", url);
    return AVATAR_FALLBACK;
  }
  try {
    const sharp = (await import("sharp")).default;
  
    const radialMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}"><defs><radialGradient id="g" cx="52%" cy="41%" r="62%"><stop offset="50%" stop-color="#fff" stop-opacity="1"/><stop offset="84%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${bw}" height="${bh}" fill="url(#g)"/></svg>`,
    );
    // Top fade: transparent at the very top → opaque by ~22% down (mirrors the live
    // card's linear-gradient(180deg, transparent 1%, #000 22%)), so the avatar
    // never covers the crest emblem at the top of the card.
    const topMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}"><defs><linearGradient id="tf" x1="0" y1="0" x2="0" y2="1"><stop offset="1%" stop-color="#fff" stop-opacity="0"/><stop offset="22%" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="${bw}" height="${bh}" fill="url(#tf)"/></svg>`,
    );
    const out = await sharp(r.buf)
      .resize(bw, bh, { fit: "cover", position: "top" })
      .composite([
        { input: radialMask, blend: "dest-in" },
        { input: topMask, blend: "dest-in" },
      ])
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString("base64")}`;
  } catch (e) {
    console.error("[renderCard] sharp feather failed:", (e as Error).message);
    return `data:${r.mime};base64,${r.buf.toString("base64")}`;
  }
}

// Load all image assets for the card at a given render width. Best-effort: a
// missing asset degrades gracefully, never throws.
// `withFonts` lets a caller that already has the (identical, static) font set
// skip re-reading the three .otf files — e.g. the duel poster renders two cards
// but passes only one card's fonts to ImageResponse.
export async function loadCardAssets(card: Card, w: number, withFonts = true) {
  const avW = Math.round((w * 68) / 100);
  const avH = Math.round((w * 70) / 100);
  const bgRel = resolveCardTheme(card).bg.replace(/\.webp$/, ".png"); // Satori can't decode webp
  const [fonts, bg, avatar, flag, logo] = await Promise.all([
    withFonts
      ? loadCardFonts()
      : Promise.resolve([] as Awaited<ReturnType<typeof loadCardFonts>>),
    fileDataUri(publicFile(bgRel), "image/png"),
    avatarDataUri(card.avatarUrl, avW, avH),
    card.country ? fileDataUri(publicFile(`/badges/flags/${card.country}.png`), "image/png") : Promise.resolve(null),
    card.languageLogo ? fetchDataUri(languageLogoUrl(card.languageLogo.slug)) : Promise.resolve(null),
  ]);
  return { fonts, bg, avatar, flag, logo, avW, avH };
}

export type CardAssets = Awaited<ReturnType<typeof loadCardAssets>>;

// The FUT card as a Satori element at width `w` (height derived from the aspect).
// Reused by the embed route (full size) and the OG unfurl (scaled down + framed).
export function cardTree(card: Card, assets: CardAssets, w: number) {
  const H = cardH(w);
  const cqw = (n: number) => (n / 100) * w;
  const at = (left: number, top: number) => ({ position: "absolute" as const, left: `${left}%`, top: `${top}%` });
  const t = resolveCardTheme(card);
  const ink = t.ink;
  const displayName = cardDisplayName(card.name).toUpperCase();
  const { bg, avatar, flag, logo, avW, avH } = assets;

  return (
    <div style={{ width: w, height: H, display: "flex", position: "relative", fontFamily: "DINPro" }}>
      {/* tier background art (stretched to the card box, like PlayerCard's objectFit:fill) */}
      {bg && <img alt="" src={bg} width={w} height={H} style={{ position: "absolute", left: 0, top: 0, width: w, height: H }} />}

      {/* avatar — pre-feathered to a FUT cut-out (alpha baked in by sharp), so the
          card art shows through its soft edges exactly like the live card */}
      <img alt="" src={avatar} width={avW} height={avH} style={{ position: "absolute", left: cqw(27), top: cqw(13), width: avW, height: avH }} />

      {/* separator lines */}
      {H_LINES.map(([l, top, ww], i) => (
        <div
          key={`h${i}`}
          style={{ ...at(l, top), width: `${ww}%`, height: cqw(0.3), backgroundColor: ink, opacity: 0.5, display: "flex" }}
        />
      ))}
      <div style={{ ...at(50, 66.46), width: cqw(0.3), height: "20.12%", backgroundColor: ink, opacity: 0.5, display: "flex" }} />

      {/* overall */}
      <div style={{ ...at(16.3, 9.76), display: "flex", fontSize: cqw(22.2), fontWeight: 500, lineHeight: 1, color: ink }}>
        {pad2(card.overall)}
      </div>

      {/* position — centered on the left identity column (~25%) */}
      <div style={{ position: "absolute", left: 0, top: "23.78%", width: "50%", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: cqw(9.3), fontWeight: 400, letterSpacing: cqw(0.19), color: ink }}>{card.position}</div>
      </div>

      {/* country flag */}
      {flag && <img alt="" src={flag} style={{ ...at(17.59, 33.17), width: "14.81%", height: "5.73%", objectFit: "contain" }} />}

      {/* top language logo */}
      {logo && <img alt="" src={logo} style={{ ...at(19.06, 42.25), width: "11.875%", height: "7.5%", objectFit: "contain" }} />}

      {/* name — centered across the card. fontSize steps down with display-name
          length via lib/text.getFitFontSize, mirroring <PlayerCard> exactly; Satori has
          no DOM to measure so the length-based heuristic is shared across both paths. */}
      <div style={{ position: "absolute", left: 0, top: "53.66%", width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: cqw(getFitFontSize(displayName)), fontWeight: 700, color: ink, whiteSpace: "nowrap" }}>{displayName}</div>
      </div>

      {/* six stat values + labels (flat absolute children so the % positions
          resolve against the card, exactly as in PlayerCard) */}
      {STAT_CELLS.map((c) => (
        <div key={`v${c.k}`} style={{ ...at(c.vx, c.vy), display: "flex", fontSize: cqw(10.2), fontWeight: 700, color: ink }}>
          {pad2(card.stats[c.k])}
        </div>
      ))}
      {STAT_CELLS.map((c) => (
        <div
          key={`l${c.k}`}
          style={{ ...at(c.lx, c.ly), display: "flex", fontSize: cqw(9.3), fontWeight: 400, letterSpacing: cqw(0.19), color: ink }}
        >
          {c.l}
        </div>
      ))}

      {/* signature — branding baked into every shared/embedded card */}
      <div style={{ ...at(8, 94.6), display: "flex", fontSize: cqw(4.1), fontWeight: 700, letterSpacing: cqw(0.4), color: ink, opacity: 0.62 }}>
        GITFUT.COM
      </div>
      <div style={{ position: "absolute", right: "8%", top: "94.6%", display: "flex", fontSize: cqw(4.1), fontWeight: 700, letterSpacing: cqw(0.4), color: ink, opacity: 0.62 }}>
        @{card.login}
      </div>
    </div>
  );
}

// The standalone embeddable card image: gitfut.com/<user>.png.
export async function renderCardImage(card: Card): Promise<ImageResponse> {
  const assets = await loadCardAssets(card, EMBED_W);
  return new ImageResponse(cardTree(card, assets, EMBED_W), {
    width: EMBED_W,
    height: cardH(EMBED_W),
    fonts: assets.fonts,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
