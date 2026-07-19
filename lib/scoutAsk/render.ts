import nunjucks from "nunjucks";
import type { Recipe } from "./types";

const env = nunjucks.configure({ autoescape: false, throwOnUndefined: false });

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return env.renderString(template, vars);
}

/** Deep-render string leaves in a recipe with Nunjucks vars. */
export function renderRecipe(recipe: Recipe, vars: Record<string, string>): Recipe {
  const json = JSON.stringify(recipe);
  const rendered = env.renderString(json, vars);
  return JSON.parse(rendered) as Recipe;
}
