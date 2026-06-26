import { ImageResponse } from "next/og";
import { fetchProfile } from "@/lib/github/client";
import { signalsFromPayload } from "@/lib/github/signals";
import { buildCard } from "@/lib/scoring/engine";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import { pickFlag } from "@/lib/flagPriority";
import { deEmDash } from "@/lib/text";
import type { Card, StatKey } from "@/lib/scoring/types";

export const runtime = "nodejs";
export const alt = "GitFut player card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-tier accent for the OG composition (gold reserved; green is the brand).
const TIER_ACCENT: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c7d0",
  gold: "#e9cc74",
  totw: "#7fa8ff",
  toty: "#7fa8ff",
  icon: "#e9cc74",
};

const STAT_ORDER: { k: StatKey; l: string }[] = [
  { k: "pac", l: "PAC" },
  { k: "sho", l: "SHO" },
  { k: "pas", l: "PAS" },
  { k: "dri", l: "DRI" },
  { k: "def", l: "DEF" },
  { k: "phy", l: "PHY" },
];

async function tryCard(username: string): Promise<Card | null> {
  if (!process.env.GITHUB_TOKEN) {
    const sample = SAMPLE_CARDS.find((c) => c.login.toLowerCase() === username.toLowerCase());
    if (sample) return sample;
  }
  try {
    return buildCard(signalsFromPayload(await fetchProfile(username)));
  } catch {
    return null;
  }
}

// Satori can't read /public by URL during image generation, so inline the flag
// PNG as a data URI read from disk. Returns null on any miss (no flag drawn).
async function flagDataUri(code: string): Promise<string | null> {
  if (!code) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "public", "badges", "flags", `${code}.png`));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const card = await tryCard(username);
  const accent = card ? TIER_ACCENT[card.finish] ?? "#39d353" : "#39d353";
  // The OG/file-convention route only receives `params` (never the URL query),
  // so the unfurl shows the card's GitHub-derived flag. A manual override is a
  // personal/session tweak and isn't reflected in the social preview.
  const flag = card ? await flagDataUri(pickFlag(null, card.country, null) ?? "") : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0d1117",
          backgroundImage:
            "radial-gradient(900px 500px at 30% -10%, rgba(57,211,83,0.16), transparent 60%), radial-gradient(700px 500px at 100% 120%, rgba(212,175,55,0.10), transparent 60%)",
          color: "#e6edf3",
          fontFamily: "sans-serif",
          padding: "64px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* left: identity + verdict */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", paddingRight: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#39d353",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            GITFUT · GITHUB × WORLD CUP 26
          </div>

          {card ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {/* avatar (Satori requires a raw img in the OG composition) */}
                <img
                  src={card.avatarUrl}
                  width={120}
                  height={120}
                  alt=""
                  style={{ borderRadius: 20, border: `3px solid ${accent}` }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{card.name}</div>
                    {flag && (
                      <img
                        src={flag}
                        width={54}
                        height={38}
                        alt=""
                        style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.14)", objectFit: "cover" }}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 26, color: "#a8b3bd" }}>
                    <span style={{ color: accent, fontWeight: 800 }}>{card.overall} OVR</span>
                    <span>·</span>
                    <span>{card.position}</span>
                    <span>·</span>
                    <span style={{ color: accent }}>{card.finishLabel}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", marginTop: 24, fontSize: 26, color: "#c9d1d9", lineHeight: 1.35, maxWidth: 560 }}>
                {card.archetype}: {deEmDash(card.archetypeBlurb)}.
              </div>

              {/* six stats */}
              <div style={{ display: "flex", gap: 28, marginTop: 32 }}>
                {STAT_ORDER.map((s) => (
                  <div key={s.k} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: accent }}>{card.stats[s.k]}</div>
                    <div style={{ display: "flex", fontSize: 18, color: "#8b949e", letterSpacing: 1 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
              <div style={{ display: "flex", fontSize: 56, fontWeight: 800 }}>@{username}</div>
              <div style={{ display: "flex", fontSize: 28, color: "#a8b3bd", marginTop: 16 }}>
                Get your GitHub rated out of 99.
              </div>
            </div>
          )}

          <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: "#6e7681" }}>gitfut.com</div>
        </div>

        {/* right: big rating chip — the prize */}
        {card && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 300,
              height: 460,
              borderRadius: 28,
              background: "#161b22",
              border: `2px solid ${accent}`,
              boxShadow: `0 0 80px ${accent}40`,
            }}
          >
            <div style={{ display: "flex", fontSize: 200, fontWeight: 900, color: accent, lineHeight: 1 }}>
              {card.overall}
            </div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 4, color: "#e6edf3" }}>
              {card.position}
            </div>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 3, color: "#8b949e", marginTop: 8 }}>
              {card.finishLabel}
            </div>
          </div>
        )}
      </div>
    ),
    size,
  );
}
