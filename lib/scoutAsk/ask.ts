import { countryName } from "@/lib/countries";
import type { Card } from "@/lib/scoring/types";
import { findNearest } from "./cosine";
import { embedText } from "./embedder";
import { extractVariables } from "./extract";
import { listCards, listTemplates } from "./idb";
import { renderRecipe, renderTemplate } from "./render";
import { rerankTemplateHits } from "./rerank";
import { runRecipe } from "./runRecipe";
import type { AskResult, StoredTemplate } from "./types";

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

export async function askScout(
  query: string,
  options?: { templates?: StoredTemplate[]; cards?: Card[]; k?: number },
): Promise<AskResult> {
  const q = query.trim();
  if (!q) throw new Error("Ask something first.");

  const templates = options?.templates ?? (await listTemplates());
  if (templates.length === 0) {
    throw new Error("Scout questions aren't indexed yet. Wait a moment and try again.");
  }

  const embedding = await embedText(q);
  // Retrieve a shortlist, then hybrid-rerank with explicit position/country signals.
  // Pure top-1 cosine collapses "CAM from Botswana" onto "strikers from {{country}}".
  const shortlist = findNearest(embedding, templates, (t) => t.embedding, options?.k ?? 5);
  const ranked = rerankTemplateHits(q, shortlist);
  const best = ranked[0];
  if (!best) throw new Error("No matching scout question.");

  const template = best.item;
  const { vars, missing } = extractVariables(q, template.variables);
  const cards = options?.cards ?? (await listCards());

  if (missing.length > 0) {
    return {
      template,
      renderedQuery: template.queryTemplate,
      score: best.score,
      vars,
      missing,
      cards: [],
    };
  }

  const recipe = renderRecipe(template.recipe, vars);
  const matched = runRecipe(cards, recipe);
  const renderedQuery = renderTemplate(template.queryTemplate, displayVars(vars));

  return {
    template,
    renderedQuery,
    score: best.score,
    vars,
    missing: [],
    cards: matched,
  };
}
