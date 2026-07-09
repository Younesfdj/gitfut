import type { Position } from "@/lib/scoring/types";
import { extractCountry, extractFinish, extractPosition, extractStat } from "./extract";
import type { QueryTemplate, StoredTemplate } from "./types";

/** Role words baked into a template's title/query - used to detect conflicts. */
const ROLE_HINTS: { re: RegExp; position: Position }[] = [
  { re: /\bstrikers?\b|\bpoachers?\b/i, position: "ST" },
  { re: /\bwingers?\b|\bright\s*wings?\b/i, position: "RW" },
  { re: /\bcam\b|attacking\s*mids?/i, position: "CAM" },
  { re: /\bcdm\b|defensive\s*mids?/i, position: "CDM" },
  { re: /\bcbs?\b|centre[- ]?backs?|center[- ]?backs?/i, position: "CB" },
];

function hardcodedPosition(template: QueryTemplate): Position | null {
  for (const f of template.recipe.filters ?? []) {
    if (f.field === "position" && f.op === "eq" && typeof f.value === "string") {
      const v = f.value.trim();
      if (v.startsWith("{{")) continue; // Jinja placeholder - not hardcoded
      if (["ST", "RW", "CAM", "CM", "CDM", "CB"].includes(v)) return v as Position;
    }
  }
  const blob = `${template.title} ${template.queryTemplate} ${template.description}`;
  for (const { re, position } of ROLE_HINTS) {
    if (re.test(blob)) return position;
  }
  return null;
}

function hasVar(template: QueryTemplate, name: string): boolean {
  return template.variables.some((v) => v.name === name || v.kind === name);
}

/**
 * Hybrid re-rank: cosine is the base, but explicit signals in the user query
 * (position / country / finish / stat) boost matching templates and penalize
 * conflicts. Fixes "top CAM from Botswana" matching "Top strikers from {{country}}".
 *
 * Vectors alone are not enough - MiniLM collapses country-heavy queries onto the
 * nearest country template. We do NOT need another LLM for this.
 */
export function rerankTemplateHits(
  query: string,
  hits: { item: StoredTemplate; score: number }[],
): { item: StoredTemplate; score: number }[] {
  const position = extractPosition(query);
  const country = extractCountry(query);
  const finish = extractFinish(query);
  const stat = extractStat(query);

  const scored = hits.map((hit) => {
    let score = hit.score;
    const t = hit.item;
    const baked = hardcodedPosition(t);

    if (position) {
      if (baked === position) score += 0.35;
      else if (baked && baked !== position) score -= 0.45;
      else if (hasVar(t, "position")) score += 0.15;
    }

    if (country && hasVar(t, "country")) score += 0.1;

    if (finish && hasVar(t, "finish")) score += 0.15;

    if (stat && hasVar(t, "stat")) score += 0.15;

    // Prefer the more specific template when both position + country are present
    // and the template isn't a conflicting hardcoded role.
    if (
      position &&
      country &&
      hasVar(t, "position") &&
      hasVar(t, "country") &&
      (!baked || baked === position)
    ) {
      score += 0.12;
    }

    return { item: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
