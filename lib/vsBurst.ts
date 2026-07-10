import { round2 } from "./format";

// Pure, deterministic geometry for the VS lightning burst — path strings, the
// sliver polygon, and the particle spray. NO "use client" and no React hooks:
// this module is consumed by both the live DuelView and the Satori OG poster
// (app/[username]/vs/[opponent]/poster.png/route.tsx), so it must stay pure.
// Its sibling geometry lib is lib/radar.ts; the SVG dressing is the component's.

type Pt = [number, number];

// ---- design grid ----
export const VS_W = 120;
export const VS_H = 170;

// ---- letterforms: blocky comic letters on a 60-tall grid ----
const LETTER_H = 60;
const V_PTS: Pt[] = [
  [0, 0],
  [16, 0],
  [25, 36],
  [34, 0],
  [50, 0],
  [32, 60],
  [18, 60],
];
const S_PTS: Pt[] = [
  [0, 0],
  [44, 0],
  [44, 13],
  [13, 13],
  [13, 24],
  [44, 24],
  [44, 60],
  [0, 60],
  [0, 47],
  [31, 47],
  [31, 36],
  [0, 36],
];

// Italic shear, a rotation about the letter's own centre, then scale + place.
function letterPath(
  pts: Pt[],
  shear: number,
  rotDeg: number,
  scale: number,
  ox: number,
  oy: number,
): string {
  const rot = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const sheared = pts.map(([x, y]): Pt => [x + (LETTER_H - y) * shear, y]);
  const cx = sheared.reduce((t, p) => t + p[0], 0) / sheared.length;
  const cy = LETTER_H / 2;
  return (
    sheared
      .map(([x, y], i) => {
        const rx = cx + (x - cx) * cos - (y - cy) * sin;
        const ry = cy + (x - cx) * sin + (y - cy) * cos;
        return `${i === 0 ? "M" : "L"}${round2(ox + rx * scale)} ${round2(oy + ry * scale)}`;
      })
      .join("") + "Z"
  );
}

// The letters: one uniform italic lean (like the art), S tucked tight against
// the V and dropped a beat lower, so the pair reads as one block the bolt
// disappears behind.
export const V_PATH = letterPath(V_PTS, 0.3, 0, 0.86, 16, 56);
export const S_PATH = letterPath(S_PTS, 0.3, 0, 0.86, 52, 66);

// ---- the lightning sliver: bottom-left tip to top-right tip ----
const T1: Pt = [14, 158];
const T2: Pt = [106, 12];
const DX = T2[0] - T1[0];
const DY = T2[1] - T1[1];
const LEN = Math.hypot(DX, DY);
const NX = -DY / LEN;
const NY = DX / LEN;

// A sliver between two arbitrary tips: both sharp, widest at the centre. The
// in-box VS bolt and the full-canvas fixture-poster bolt share this shape.
export function sliverBetween(t1: Pt, t2: Pt, hw: number): string {
  const cx = (t1[0] + t2[0]) / 2;
  const cy = (t1[1] + t2[1]) / 2;
  const dx = t2[0] - t1[0];
  const dy = t2[1] - t1[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  return [
    `${t1[0]},${t1[1]}`,
    `${round2(cx + nx * hw)},${round2(cy + ny * hw)}`,
    `${t2[0]},${t2[1]}`,
    `${round2(cx - nx * hw)},${round2(cy - ny * hw)}`,
  ].join(" ");
}

// A sliver of the given half-width: both tips sharp, widest at the centre.
export const sliver = (hw: number): string => sliverBetween(T1, T2, hw);

export interface Particle {
  x: number;
  y: number;
  r: number;
  o: number;
  bright: boolean;
}

// Particle spray clustered tight around both tips (deterministic — no
// Math.random, the same burst every render on server, client and poster).
export const PARTICLES: Particle[] = Array.from({ length: 26 }, (_, i) => {
  const t = i < 13 ? 0.01 + i * 0.019 : 0.74 + (i - 13) * 0.019;
  const off = (((i * 37) % 11) - 5) * 0.95;
  return {
    x: round2(T1[0] + DX * t + NX * off),
    y: round2(T1[1] + DY * t + NY * off),
    r: round2(0.4 + ((i * 53) % 12) / 12),
    o: 0.35 + ((i * 29) % 45) / 100,
    bright: i % 3 === 0,
  };
});

// Ember spray for the fixture poster's full-canvas bolt: deterministic like
// PARTICLES, but clustered around the run's MIDDLE (where the VS sits) — the
// tips sit off-canvas there, so tip clusters would never be seen.
export function particlesAlong(
  t1: Pt,
  t2: Pt,
  count: number,
  spread: number,
  rBase: number,
): Particle[] {
  const dx = t2[0] - t1[0];
  const dy = t2[1] - t1[1];
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  return Array.from({ length: count }, (_, i) => {
    const u = (i + 0.5) / count;
    // pull every sample toward t=0.5 by a pseudo-random amount: dense near the
    // VS, sparse toward the canvas edges
    const t = 0.5 + (u - 0.5) * (0.35 + ((i * 31) % 8) / 10);
    const off = (((i * 37) % 23) - 11) * spread;
    return {
      x: round2(t1[0] + dx * t + nx * off),
      y: round2(t1[1] + dy * t + ny * off),
      r: round2(rBase * (0.4 + ((i * 53) % 12) / 12)),
      o: 0.35 + ((i * 29) % 45) / 100,
      bright: i % 3 === 0,
    };
  });
}

// Rendered box for a given height: width derived from the design aspect.
export function vsBurstBox(size: number): { w: number; h: number } {
  return { w: Math.round((size * VS_W) / VS_H), h: size };
}
