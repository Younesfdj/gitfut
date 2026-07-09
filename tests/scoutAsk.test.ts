import { describe, expect, it } from "vitest";
import { cosineSimilarity, findNearest, l2Normalize } from "@/lib/scoutAsk/cosine";
import {
  extractCountry,
  extractFinish,
  extractPosition,
  extractStat,
  extractVariables,
} from "@/lib/scoutAsk/extract";
import { renderRecipe, renderTemplate } from "@/lib/scoutAsk/render";
import { runRecipe } from "@/lib/scoutAsk/runRecipe";
import type { Card } from "@/lib/scoring/types";
import type { Recipe } from "@/lib/scoutAsk/types";

function fakeCard(partial: Partial<Card> & Pick<Card, "login">): Card {
  return {
    name: partial.login,
    avatarUrl: "",
    country: "us",
    club: "neutral",
    stats: { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 },
    position: "ST",
    family: "Forward",
    baseOVR: 70,
    overall: 70,
    finish: "gold",
    finishLabel: "GOLD",
    archetype: "Poacher",
    archetypeBlurb: "",
    legacy: { L: 0 },
    report: {
      skillMoves: 3,
      weakFoot: 3,
      workRate: { attack: "Med", defense: "Med" },
      style: "",
      reasons: { skillMoves: "", weakFoot: "", workRate: "", style: "" },
      playstyles: [],
      metrics: [],
    },
    ...partial,
  };
}

describe("cosine", () => {
  it("returns 1 for identical vectors", () => {
    const v = l2Normalize([1, 2, 3, 4]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("ranks nearest by cosine", () => {
    const items = [
      { id: "a", embedding: [1, 0, 0] },
      { id: "b", embedding: [0.9, 0.1, 0] },
      { id: "c", embedding: [0, 1, 0] },
    ];
    const hits = findNearest([1, 0, 0], items, (x) => x.embedding, 2);
    expect(hits[0]!.item.id).toBe("a");
    expect(hits[1]!.item.id).toBe("b");
  });
});

describe("extract", () => {
  it("extracts Botswana as bw", () => {
    expect(extractCountry("Who are the top strikers from Botswana?")).toBe("bw");
  });

  it("does not treat position ST as Sao Tome", () => {
    expect(extractCountry("Who are the top ST from Botswana?")).toBe("bw");
    expect(extractPosition("Who are the top ST from Botswana?")).toBe("ST");
    expect(extractCountry("Top CAM from Botswana")).toBe("bw");
    expect(extractCountry("Top CB from Nigeria")).toBe("ng");
  });

  it("extracts South Africa", () => {
    expect(extractCountry("Best centre-backs from South Africa")).toBe("za");
  });

  it("maps striker synonyms to ST", () => {
    expect(extractPosition("top strikers from Botswana")).toBe("ST");
    expect(extractPosition("best centre-backs")).toBe("CB");
  });

  it("maps finish synonyms", () => {
    expect(extractFinish("Who has Icon cards?")).toBe("icon");
    expect(extractFinish("Rising In-Form players")).toBe("totw");
  });

  it("maps stat synonyms", () => {
    expect(extractStat("Who has the highest pace?")).toBe("pac");
    expect(extractStat("Highest shooting players")).toBe("sho");
  });

  it("reports missing required vars", () => {
    const { vars, missing } = extractVariables("top strikers please", [
      { name: "country", kind: "country", required: true },
    ]);
    expect(vars.country).toBeUndefined();
    expect(missing).toHaveLength(1);
  });
});

describe("nunjucks render", () => {
  it("substitutes country in query template", () => {
    expect(renderTemplate("Top strikers from {{country}}", { country: "Botswana" })).toBe(
      "Top strikers from Botswana",
    );
  });

  it("renders recipe filter values", () => {
    const recipe: Recipe = {
      filters: [
        { field: "position", op: "eq", value: "ST" },
        { field: "country", op: "eq", value: "{{country}}" },
      ],
      sort: { by: "overall", dir: "desc" },
      limit: 5,
    };
    const out = renderRecipe(recipe, { country: "bw" });
    expect(out.filters?.[1]).toEqual({ field: "country", op: "eq", value: "bw" });
  });
});

describe("runRecipe", () => {
  const cards = [
    fakeCard({ login: "a", position: "ST", country: "bw", overall: 88 }),
    fakeCard({ login: "b", position: "ST", country: "bw", overall: 91 }),
    fakeCard({ login: "c", position: "CB", country: "bw", overall: 90 }),
    fakeCard({ login: "d", position: "ST", country: "za", overall: 95 }),
  ];

  it("filters ST + country and sorts by overall", () => {
    const out = runRecipe(cards, {
      filters: [
        { field: "position", op: "eq", value: "ST" },
        { field: "country", op: "eq", value: "bw" },
      ],
      sort: { by: "overall", dir: "desc" },
      limit: 5,
    });
    expect(out.map((c) => c.login)).toEqual(["b", "a"]);
  });

  it("sorts by a stat key", () => {
    const out = runRecipe(
      [
        fakeCard({ login: "slow", stats: { pac: 50, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 } }),
        fakeCard({ login: "fast", stats: { pac: 95, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 } }),
      ],
      { sort: { by: "pac", dir: "desc" }, limit: 1 },
    );
    expect(out[0]!.login).toBe("fast");
  });

  it("filters founder exists", () => {
    const out = runRecipe(
      [
        fakeCard({
          login: "founder",
          founder: {
            art: "/x.png",
            accent: "#fff",
            label: "FOUNDER",
            tagline: "x",
          },
        }),
        fakeCard({ login: "normal" }),
      ],
      { filters: [{ field: "founder", op: "exists", value: true }] },
    );
    expect(out.map((c) => c.login)).toEqual(["founder"]);
  });
});

describe("rerank", () => {
  it("prefers position+country over strikers when query says CAM", async () => {
    const { rerankTemplateHits } = await import("@/lib/scoutAsk/rerank");
    const { QUERY_CATALOG } = await import("@/lib/scoutAsk/catalog");
    const fake = QUERY_CATALOG.map((t) => ({
      ...t,
      embedding: new Array(8).fill(0.1),
      catalogVersion: 2,
    }));
    // Simulate cosine preferring strikers (higher base score) - rerank must flip it.
    const hits = [
      { item: fake.find((t) => t.id === "strikers-by-country")!, score: 0.92 },
      { item: fake.find((t) => t.id === "position-by-country")!, score: 0.8 },
      { item: fake.find((t) => t.id === "by-position")!, score: 0.75 },
    ];
    const ranked = rerankTemplateHits("Who are the top CAM from Botswana?", hits);
    expect(ranked[0]!.item.id).toBe("position-by-country");
  });

  it("keeps strikers template for striker queries", async () => {
    const { rerankTemplateHits } = await import("@/lib/scoutAsk/rerank");
    const { QUERY_CATALOG } = await import("@/lib/scoutAsk/catalog");
    const fake = QUERY_CATALOG.map((t) => ({
      ...t,
      embedding: new Array(8).fill(0.1),
      catalogVersion: 2,
    }));
    const hits = [
      { item: fake.find((t) => t.id === "strikers-by-country")!, score: 0.9 },
      { item: fake.find((t) => t.id === "position-by-country")!, score: 0.85 },
    ];
    const ranked = rerankTemplateHits("Who are the top strikers from Botswana?", hits);
    expect(ranked[0]!.item.id).toBe("strikers-by-country");
  });
});

describe("locationQueries", () => {
  it("lists Botswana terms with Gaborone (not a broken OR string)", async () => {
    const { locationTermsForCountry, githubLocationQualifier, githubLocationQuery } =
      await import("@/lib/scoutAsk/locationQueries");
    const terms = locationTermsForCountry("bw");
    expect(terms).toContain("Gaborone");
    expect(terms).toContain("Botswana");
    expect(githubLocationQualifier("Gaborone")).toBe("location:Gaborone");
    expect(githubLocationQualifier("South Africa")).toBe('location:"South Africa"');
    // Document the invalid OR form so we never ship it as the live query again.
    expect(githubLocationQuery("bw")).toContain(" OR ");
  });
});

describe("geo Botswana", () => {
  it("maps Gaborone and Botswana to bw", async () => {
    const { countryFromLocation } = await import("@/lib/geo");
    expect(countryFromLocation("Gaborone")).toBe("bw");
    expect(countryFromLocation("Botswana")).toBe("bw");
    expect(countryFromLocation("Gaborone, Botswana")).toBe("bw");
  });
});
