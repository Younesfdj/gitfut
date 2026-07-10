import { describe, expect, it } from "vitest";
import {
  PARTICLES,
  S_PATH,
  V_PATH,
  VS_H,
  VS_W,
  sliver,
  vsBurstBox,
} from "@/lib/vsBurst";

// We test the pure GEOMETRY the VS burst encodes — the lightning sliver, the
// letter paths, the deterministic particle spray, and the size→box mapping.
// The SVG dressing (fills, opacities) is the component's job. This geometry is
// rendered by both the live DuelView and the Satori OG poster, so it must stay
// byte-stable and framework-free.

const pts = (poly: string) => poly.split(" ").map((p) => p.split(",").map(Number));
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("sliver", () => {
  // Fixed tips from the design grid: bottom-left → top-right.
  const T1 = [14, 158];
  const T2 = [106, 12];
  const CENTER = [(T1[0] + T2[0]) / 2, (T1[1] + T2[1]) / 2]; // 60, 85

  it("is a 4-point kite: both tips sharp, a mid point either side", () => {
    const p = pts(sliver(7));
    expect(p).toHaveLength(4);
    expect(p[0]).toEqual(T1);
    expect(p[2]).toEqual(T2);
  });

  it("collapses to a zero-width spike at the centre when half-width is 0", () => {
    const p = pts(sliver(0));
    expect(p[1]).toEqual(CENTER);
    expect(p[3]).toEqual(CENTER);
  });

  it("mirrors the two flanks about the centre and widens with half-width", () => {
    const p = pts(sliver(7));
    // p1 and p3 are reflections of each other through the centre.
    expect(p[1][0] + p[3][0]).toBeCloseTo(2 * CENTER[0], 5);
    expect(p[1][1] + p[3][1]).toBeCloseTo(2 * CENTER[1], 5);
    // a wider sliver pushes the flank further from the tip axis.
    expect(dist(pts(sliver(9))[1], CENTER)).toBeGreaterThan(
      dist(pts(sliver(3))[1], CENTER),
    );
  });

  it("rounds coordinates to 2 decimals (deterministic across renders)", () => {
    for (const c of pts(sliver(3.8)).flat()) {
      expect(Number.isInteger(Math.round(c * 100))).toBe(true);
      expect(c).toBe(Math.round(c * 100) / 100);
    }
  });
});

describe("letter paths", () => {
  const anchors = (d: string) => d.match(/[ML]/g) ?? [];

  it("V is a closed 7-point polygon path", () => {
    expect(V_PATH.startsWith("M")).toBe(true);
    expect(V_PATH.endsWith("Z")).toBe(true);
    expect(anchors(V_PATH)).toHaveLength(7); // one M + six L, from V_PTS
  });

  it("S is a closed 12-point polygon path", () => {
    expect(S_PATH.startsWith("M")).toBe(true);
    expect(S_PATH.endsWith("Z")).toBe(true);
    expect(anchors(S_PATH)).toHaveLength(12); // one M + eleven L, from S_PTS
  });
});

describe("PARTICLES", () => {
  it("is a deterministic spray of 26 particles", () => {
    expect(PARTICLES).toHaveLength(26);
  });

  it("marks every third particle bright and keeps values in range", () => {
    PARTICLES.forEach((p, i) => {
      expect(p.bright).toBe(i % 3 === 0);
      expect(p.r).toBeGreaterThan(0);
      expect(p.o).toBeGreaterThanOrEqual(0.35);
      expect(p.o).toBeLessThan(0.8);
      // clustered near the two tips, so within the design grid
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(VS_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(VS_H);
    });
  });

  it("rounds x/y/r to 2 decimals", () => {
    for (const p of PARTICLES) {
      for (const c of [p.x, p.y, p.r]) {
        expect(c).toBe(Math.round(c * 100) / 100);
      }
    }
  });
});

describe("vsBurstBox", () => {
  it("derives width from the design aspect, height = size", () => {
    // at the native height the box is exactly the design grid
    expect(vsBurstBox(VS_H)).toEqual({ w: VS_W, h: VS_H });
    // the header (104) and the poster (264) sizes used in the app
    expect(vsBurstBox(104)).toEqual({ w: Math.round((104 * VS_W) / VS_H), h: 104 });
    expect(vsBurstBox(264)).toEqual({ w: Math.round((264 * VS_W) / VS_H), h: 264 });
  });
});
