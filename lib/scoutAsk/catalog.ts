import type { QueryTemplate } from "./types";

/**
 * Seed catalog of Jinja-style query templates.
 * Embeddings are generated at bootstrap; placeholders stay in the indexed text.
 */
export const QUERY_CATALOG: readonly QueryTemplate[] = [
  {
    id: "position-by-country",
    title: "Top players by position and country",
    description:
      "Highest-rated players at a given position from a given country. Covers CAM, ST, CB, CDM, CM, RW.",
    queryTemplate: "Top {{position}} from {{country}}",
    variables: [
      { name: "position", kind: "position", required: true },
      { name: "country", kind: "country", required: true },
    ],
    recipe: {
      filters: [
        { field: "position", op: "eq", value: "{{position}}" },
        { field: "country", op: "eq", value: "{{country}}" },
      ],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: [
      "Who are the top CAM from Botswana?",
      "Top CDM from South Africa",
      "Best RW from Nigeria",
    ],
  },
  {
    id: "strikers-by-country",
    title: "Top strikers by country",
    description: "Highest-rated strikers (ST) from a given country.",
    queryTemplate: "Top strikers from {{country}}",
    variables: [{ name: "country", kind: "country", required: true }],
    recipe: {
      filters: [
        { field: "position", op: "eq", value: "ST" },
        { field: "country", op: "eq", value: "{{country}}" },
      ],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Who are the top strikers from Botswana?", "Top strikers from South Africa"],
  },
  {
    id: "cbs-by-country",
    title: "Best centre-backs by country",
    description: "Highest-rated centre-backs (CB) from a given country.",
    queryTemplate: "Best centre-backs from {{country}}",
    variables: [{ name: "country", kind: "country", required: true }],
    recipe: {
      filters: [
        { field: "position", op: "eq", value: "CB" },
        { field: "country", op: "eq", value: "{{country}}" },
      ],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Best centre-backs from South Africa", "Top CBs from Nigeria"],
  },
  {
    id: "by-position",
    title: "Top players by position",
    description: "Highest-rated players at a given position worldwide.",
    queryTemplate: "Top {{position}} players",
    variables: [{ name: "position", kind: "position", required: true }],
    recipe: {
      filters: [{ field: "position", op: "eq", value: "{{position}}" }],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Top CAM players", "Best strikers overall"],
  },
  {
    id: "by-finish",
    title: "Cards by finish tier",
    description: "Players with a given card finish (Icon, TOTY, In-Form, Gold, …).",
    queryTemplate: "Who has {{finish}} cards?",
    variables: [{ name: "finish", kind: "finish", required: true }],
    recipe: {
      filters: [{ field: "finish", op: "eq", value: "{{finish}}" }],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Who has Icon cards?", "Show me In-Form players"],
  },
  {
    id: "by-archetype",
    title: "Players by archetype",
    description: "Find players matching an archetype name (Poacher, Regista, …).",
    queryTemplate: "Show me {{archetype}} players",
    variables: [{ name: "archetype", kind: "archetype", required: true }],
    recipe: {
      filters: [{ field: "archetype", op: "includes", value: "{{archetype}}" }],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Show me Poacher players", "Find Regista playmakers"],
  },
  {
    id: "language-playmakers",
    title: "Playmakers by language",
    description: "Playmaker-family cards whose top language matches.",
    queryTemplate: "Top {{language}} playmakers",
    variables: [{ name: "language", kind: "language", required: true }],
    recipe: {
      filters: [
        { field: "family", op: "eq", value: "Playmaker" },
        { field: "topLanguage", op: "eq", value: "{{language}}" },
      ],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Top TypeScript playmakers", "Best Rust playmakers"],
  },
  {
    id: "highest-stat",
    title: "Highest by stat",
    description: "Rank players by a single FIFA-style attribute.",
    queryTemplate: "Highest {{stat}} players",
    variables: [{ name: "stat", kind: "stat", required: true }],
    recipe: {
      sort: { by: "{{stat}}", dir: "desc" },
      limit: 15,
    },
    examples: ["Who has the highest pace?", "Highest shooting players"],
  },
  {
    id: "best-forwards",
    title: "Best Forwards overall",
    description: "Top Forward-family cards by overall.",
    queryTemplate: "Best Forwards overall",
    variables: [],
    recipe: {
      filters: [{ field: "family", op: "eq", value: "Forward" }],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Best Forwards overall", "Top forwards"],
  },
  {
    id: "rising-inform",
    title: "Rising In-Form players",
    description: "TOTW / In-Form finish cards.",
    queryTemplate: "Rising In-Form players",
    variables: [],
    recipe: {
      filters: [{ field: "finish", op: "eq", value: "totw" }],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Rising In-Form players", "Show me TOTW cards"],
  },
  {
    id: "founders",
    title: "Founder cards",
    description: "GitFut founder special cards.",
    queryTemplate: "Founder cards",
    variables: [],
    recipe: {
      filters: [{ field: "founder", op: "exists", value: true }],
      sort: { by: "overall", dir: "desc" },
      limit: 15,
    },
    examples: ["Any Founder cards?", "Show founder cards"],
  },
];

/** Flat list of example chips for the Ask UI. */
export function askExampleChips(): string[] {
  const out: string[] = [];
  for (const t of QUERY_CATALOG) {
    if (t.examples?.[0]) out.push(t.examples[0]);
  }
  return out.slice(0, 6);
}
