import { STAT_LABELS, STATS } from "./scoring/constants";
import type { Stats } from "./scoring/types";
import { round2 } from "./format";

export interface RadarVertex {
  x: number;
  y: number;
}

export interface RadarLabel extends RadarVertex {
  label: string;
}

export interface RadarGeometry {
  center: number;
  radius: number;
  /** Stat polygon corners, STATS order. */
  vertices: RadarVertex[];
  /** SVG points attribute for the stat polygon. */
  points: string;
  /** Concentric hexagon outlines at 1/3, 2/3 and the full radius. */
  rings: string[];
  /** One hexagon wedge per axis: centre → edge-mid → vertex → edge-mid. */
  sectors: string[];
  /** One label per stat, anchored just outside the outer ring. */
  labels: RadarLabel[];
}

const RING_FRACTIONS = [1 / 3, 2 / 3, 1];
const RADIUS_SHARE = 0.72; // of the half-size — the rest is label breathing room
const LABEL_GAP_SHARE = 0.1; // of the full size, beyond the outer ring

// Axis i sits at -90° + i·60°: PAC up top, then clockwise with STATS.
const angleFor = (i: number) => ((-90 + i * 60) * Math.PI) / 180;

// One axis' wedge of the hexagon: centre → edge midpoint → vertex → edge
// midpoint. Callers may pass a radius beyond the ring's (bigger hit zones).
export function radarSector(
  center: number,
  radius: number,
  axis: number,
): string {
  const mid = radius * Math.cos(Math.PI / 6); // hexagon edge midpoints sit at R·cos30°
  const theta = angleFor(axis);
  const pt = (r: number, a: number) =>
    `${round2(center + r * Math.cos(a))},${round2(center + r * Math.sin(a))}`;
  return [
    `${center},${center}`,
    pt(mid, theta - Math.PI / 6),
    pt(radius, theta),
    pt(mid, theta + Math.PI / 6),
  ].join(" ");
}

export function radarGeometry(stats: Stats, size: number): RadarGeometry {
  const center = size / 2;
  const radius = center * RADIUS_SHARE;

  const at = (r: number, i: number): RadarVertex => ({
    x: round2(center + r * Math.cos(angleFor(i))),
    y: round2(center + r * Math.sin(angleFor(i))),
  });
  const outline = (r: number) =>
    STATS.map((_, i) => at(r, i))
      .map((v) => `${v.x},${v.y}`)
      .join(" ");

  const vertices = STATS.map((key, i) =>
    at((radius * Math.min(Math.max(stats[key], 0), 99)) / 99, i),
  );

  return {
    center,
    radius,
    vertices,
    points: vertices.map((v) => `${v.x},${v.y}`).join(" "),
    rings: RING_FRACTIONS.map((f) => outline(radius * f)),
    sectors: STATS.map((_, i) => radarSector(center, radius, i)),
    labels: STATS.map((key, i) => ({
      label: STAT_LABELS[key],
      ...at(radius + size * LABEL_GAP_SHARE, i),
    })),
  };
}
