import type { Card, StatKey } from "@/lib/scoring/types";
import { STATS } from "@/lib/scoring/constants";
import type { Recipe, RecipeFilter, RecipeSortBy } from "./types";

function matchesFilter(card: Card, filter: RecipeFilter): boolean {
  switch (filter.field) {
    case "position":
      return filter.op === "eq" && card.position === filter.value;
    case "family":
      return filter.op === "eq" && card.family === filter.value;
    case "country":
      return (
        filter.op === "eq" &&
        card.country.toLowerCase() === String(filter.value).toLowerCase()
      );
    case "finish":
      return filter.op === "eq" && card.finish === filter.value;
    case "archetype":
      return (
        filter.op === "includes" &&
        card.archetype.toLowerCase().includes(String(filter.value).toLowerCase())
      );
    case "topLanguage":
      return (
        filter.op === "eq" &&
        (card.topLanguage ?? "").toLowerCase() === String(filter.value).toLowerCase()
      );
    case "founder": {
      const want = filter.value !== false;
      return want ? Boolean(card.founder) : !card.founder;
    }
    default:
      return true;
  }
}

function sortValue(card: Card, by: RecipeSortBy): number {
  if (by === "overall") return card.overall;
  if ((STATS as string[]).includes(by)) return card.stats[by as StatKey] ?? 0;
  return 0;
}

export function runRecipe(cards: Card[], recipe: Recipe): Card[] {
  let out = cards.slice();
  for (const f of recipe.filters ?? []) {
    out = out.filter((c) => matchesFilter(c, f));
  }
  if (recipe.sort) {
    const dir = recipe.sort.dir === "asc" ? 1 : -1;
    const by = recipe.sort.by;
    out.sort((a, b) => (sortValue(a, by) - sortValue(b, by)) * dir);
  }
  const limit = recipe.limit ?? out.length;
  return out.slice(0, Math.max(0, limit));
}
