import { describe, expect, it } from "vitest";
import { buildCard } from "@/lib/scoring/engine";
import type { Signals } from "@/lib/scoring/types";

// A modest, non-founder profile — exercises the normal scoring path.
const base: Signals = {
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  location: "San Francisco",
  followers: 50,
  account_age_years: 3,
  public_repos: 20,
  total_stars_owned: 100,
  max_repo_stars: 40,
  languages: 5,
  rankedLanguages: ["TypeScript", "Go"],
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
};

const withLogin = (login: string): Signals => ({ ...base, login });

describe("buildCard — founder overrides", () => {
  it("forces younesfdj to a fixed overall above 89", () => {
    const card = buildCard(withLogin("younesfdj"));
    expect(card.overall).toBe(93);
    expect(card.overall).toBeGreaterThan(89);
  });

  it("forces mawsis to a fixed overall above 89", () => {
    const card = buildCard(withLogin("mawsis"));
    expect(card.overall).toBe(91);
    expect(card.overall).toBeGreaterThan(89);
  });

  it("gives founders the dedicated 'founder' tier (not auto-promoted to icon)", () => {
    expect(buildCard(withLogin("younesfdj")).finish).toBe("founder");
    expect(buildCard(withLogin("mawsis")).finish).toBe("founder");
  });

  it("attaches per-founder art + accent to the card", () => {
    const younes = buildCard(withLogin("younesfdj"));
    expect(younes.founder).toBeDefined();
    expect(younes.founder?.art).toContain("founder-red");
    expect(younes.founder?.accent).toBe("#ff2f45");

    const mawsis = buildCard(withLogin("mawsis"));
    expect(mawsis.founder?.art).toContain("founder-chrome");
    expect(mawsis.founder?.accent).toBe("#d8dde3");
  });

  it("matches founder logins case-insensitively", () => {
    expect(buildCard(withLogin("YounesFDJ")).finish).toBe("founder");
    expect(buildCard(withLogin("MAWSIS")).overall).toBe(91);
  });

  it("leaves non-founders untouched", () => {
    const card = buildCard(withLogin("some-random-dev"));
    expect(card.finish).not.toBe("founder");
    expect(card.founder).toBeUndefined();
  });
});

describe("buildCard — recent contribution spike", () => {
  it("promotes an otherwise identical gold card to in-form", () => {
    const steady = buildCard({ ...base, recent_spike: false });
    const spiking = buildCard({ ...base, recent_spike: true });

    expect(spiking.overall).toBe(steady.overall);
    expect(steady.finish).toBe("gold");
    expect(spiking.finish).toBe("totw");
  });
});
