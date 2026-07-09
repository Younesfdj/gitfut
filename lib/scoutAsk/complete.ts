import { countryName } from "@/lib/countries";
import type { Card } from "@/lib/scoring/types";
import { listCards } from "./idb";
import { renderRecipe, renderTemplate } from "./render";
import { runRecipe } from "./runRecipe";
import type { AskResult, QueryTemplate } from "./types";

function displayVars(vars: Record<string, string>): Record<string, string> {
  const out = { ...vars };
  if (out.country) {
    out.country = countryName(out.country) ?? out.country;
  }
  if (out.stat) out.stat = out.stat.toUpperCase();
  if (out.finish) {
    const labels: Record<string, string> = {
      totw: "In-Form",
      toty: "TOTY",
      icon: "Icon",
      founder: "Founder",
      gold: "Gold",
      silver: "Silver",
      bronze: "Bronze",
    };
    out.finish = labels[out.finish] ?? out.finish;
  }
  return out;
}

/** Finish an Ask after the user supplies a missing variable (no re-embed). */
export async function completeAskWithVars(
  template: QueryTemplate,
  score: number,
  vars: Record<string, string>,
  cards?: Card[],
): Promise<AskResult> {
  const corpus = cards ?? (await listCards());
  const recipe = renderRecipe(template.recipe, vars);
  const matched = runRecipe(corpus, recipe);
  return {
    template,
    renderedQuery: renderTemplate(template.queryTemplate, displayVars(vars)),
    score,
    vars,
    missing: [],
    cards: matched,
  };
}
