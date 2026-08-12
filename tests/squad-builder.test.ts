import { describe, expect, it } from "vitest";
import { buildBestXI, positionFit } from "@/lib/squad-builder";
import { buildCard } from "@/lib/scoring/engine";
import type { Card, Signals } from "@/lib/scoring/types";

const makeCard = (overrides: Partial<Signals>): Card => {
  const base: Signals = {
    login: "test-user",
    name: "Test User",
    avatarUrl: "https://example.com/avatar.png",
    location: null,
    followers: 50,
    account_age_years: 3,
    public_repos: 20,
    total_stars_owned: 100,
    max_repo_stars: 40,
    languages: 5,
    rankedLanguages: ["TypeScript"],
    topLanguage: "TypeScript",
    recent_contributions: 300,
    active_days_recent: 100,
    active_years: 3,
    total_contributions_lifetime: 1500,
    prs_to_others: 5,
    reviews: 3,
    issues_closed: 4,
    recent_commits: 280,
    recent_spike: false,
    ...overrides,
  };
  return buildCard(base);
};

describe("positionFit", () => {
  it("returns 1.0 for natural position", () => {
    const card = makeCard({ login: "forward-player" });
    // The card's position depends on stats; use whatever it is
    expect(positionFit(card, card.position)).toBe(1.0);
  });

  it("returns < 1.0 for out-of-position", () => {
    const card = makeCard({ login: "forward-player" });
    // A forward placed in GK should have low fit
    const fit = positionFit(card, "GK");
    expect(fit).toBeLessThan(1.0);
  });

  it("returns higher fit for same group than cross-group", () => {
    const card = makeCard({
      login: "midfielder",
      recent_contributions: 400,
      prs_to_others: 20,
      reviews: 15,
    });
    // An attack-ish player might be CM or CAM
    const attackFit = positionFit(card, "ST");
    const gkFit = positionFit(card, "GK");
    expect(attackFit).toBeGreaterThanOrEqual(gkFit);
  });
});

describe("buildBestXI", () => {
  it("returns empty result for empty input", () => {
    const result = buildBestXI([]);
    expect(result.best.xi).toHaveLength(0);
    expect(result.best.teamOVR).toBe(0);
  });

  it("fills what it can with fewer than 11 players", () => {
    const players = Array.from({ length: 5 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    expect(result.best.xi.length).toBeLessThanOrEqual(5);
    expect(result.best.xi.length).toBeGreaterThan(0);
  });

  it("does not duplicate players", () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    const logins = result.best.xi.map((x) => x.card.login);
    expect(new Set(logins).size).toBe(logins.length);
  });

  it("picks exactly 11 when enough players exist", () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    expect(result.best.xi).toHaveLength(11);
  });

  it("always includes a GK slot", () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    const positions = result.best.xi.map((x) => x.slot.position);
    expect(positions).toContain("GK");
  });

  it("returns multiple formation candidates", () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    expect(result.all.length).toBeGreaterThan(1);
  });

  it("best formation has highest teamOVR", () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    for (const alt of result.all) {
      expect(result.best.teamOVR).toBeGreaterThanOrEqual(alt.teamOVR);
    }
  });

  it("bench contains unused players", () => {
    const players = Array.from({ length: 15 }, (_, i) =>
      makeCard({ login: `player-${i}` }),
    );
    const result = buildBestXI(players);
    const xiLogins = new Set(result.best.xi.map((x) => x.card.login));
    for (const b of result.best.bench) {
      expect(xiLogins.has(b.login)).toBe(false);
    }
  });

  it("handles all attackers (no natural defenders/GK)", () => {
    // All cards with high SHO/PAC — should still fill a lineup
    const players = Array.from({ length: 12 }, (_, i) =>
      makeCard({
        login: `attacker-${i}`,
        recent_contributions: 800,
        total_stars_owned: 5000,
        max_repo_stars: 3000,
      }),
    );
    const result = buildBestXI(players);
    expect(result.best.xi.length).toBe(11);
    // GK will be an emergency pick (out of position)
    const gk = result.best.xi.find((x) => x.slot.position === "GK");
    expect(gk).toBeDefined();
  });
});
