import { describe, expect, it } from "vitest";
import type { Finish } from "@/lib/scoring/types";
import { hasBurst, sequenceDuration, sequenceFor } from "./reveal";

// We test the DECISIONS the sequencer encodes (which tiers earn a burst, the
// reduced-motion collapse, phase ordering) — not the animation rendering.

const phases = (f: Finish, reduced = false) => sequenceFor(f, reduced).map((s) => s.phase);

describe("reveal sequencer", () => {
  it("common tiers (bronze/silver/gold) rise → ignite → freeze, no burst", () => {
    for (const f of ["bronze", "silver", "gold"] as Finish[]) {
      expect(phases(f)).toEqual(["rise", "ignite", "freeze"]);
      expect(hasBurst(f)).toBe(false);
    }
  });

  it("rare event tiers (totw/toty/icon) include the burst", () => {
    for (const f of ["totw", "toty", "icon"] as Finish[]) {
      expect(phases(f)).toEqual(["rise", "ignite", "burst", "freeze"]);
      expect(hasBurst(f)).toBe(true);
    }
  });

  it("burst always sits between ignite and freeze", () => {
    const steps = sequenceFor("icon", false);
    const order = steps.map((s) => s.phase);
    expect(order.indexOf("burst")).toBeGreaterThan(order.indexOf("ignite"));
    expect(order.indexOf("burst")).toBeLessThan(order.indexOf("freeze"));
  });

  it("step timings are strictly increasing", () => {
    const steps = sequenceFor("toty", false);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].at).toBeGreaterThan(steps[i - 1].at);
    }
  });

  it("reduced motion collapses every tier to a single freeze at 0ms", () => {
    for (const f of ["bronze", "gold", "icon", "toty"] as Finish[]) {
      const steps = sequenceFor(f, true);
      expect(steps).toEqual([{ phase: "freeze", at: 0 }]);
      expect(sequenceDuration(f, true)).toBe(0);
    }
  });

  it("rare reveals run longer than common ones (more spectacle = more time)", () => {
    expect(sequenceDuration("icon", false)).toBeGreaterThan(sequenceDuration("gold", false));
  });
});
