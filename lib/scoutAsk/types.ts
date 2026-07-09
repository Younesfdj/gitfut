import type { Card, Family, Finish, Position, StatKey } from "@/lib/scoring/types";

export const EMBEDDING_DIM = 384;
export const CATALOG_VERSION = 3;
export const DB_NAME = "gitfut-scout-ask";
export const DB_VERSION = 1;

export type VarKind =
  | "country"
  | "position"
  | "finish"
  | "stat"
  | "archetype"
  | "language"
  | "family";

export interface TemplateVariable {
  name: string;
  kind: VarKind;
  required?: boolean;
}

/** Structured filter/sort recipe - no free-form JS. */
export interface Recipe {
  filters?: RecipeFilter[];
  sort?: { by: RecipeSortBy; dir?: "asc" | "desc" };
  limit?: number;
}

export type RecipeFilter =
  | { field: "position"; op: "eq"; value: Position | string }
  | { field: "family"; op: "eq"; value: Family | string }
  | { field: "country"; op: "eq"; value: string }
  | { field: "finish"; op: "eq"; value: Finish | string }
  | { field: "archetype"; op: "includes"; value: string }
  | { field: "topLanguage"; op: "eq"; value: string }
  | { field: "founder"; op: "exists"; value?: boolean };

/** Pre-render recipes may use Jinja placeholders like `{{stat}}`. */
export type RecipeSortBy = "overall" | StatKey | string;

export interface QueryTemplate {
  id: string;
  title: string;
  description: string;
  queryTemplate: string;
  variables: TemplateVariable[];
  recipe: Recipe;
  /** Example NL chips shown in Ask mode (already filled). */
  examples?: string[];
}

export interface StoredTemplate extends QueryTemplate {
  embedding: number[];
  catalogVersion: number;
}

export interface AskResult {
  template: QueryTemplate;
  renderedQuery: string;
  score: number;
  vars: Record<string, string>;
  missing: TemplateVariable[];
  cards: Card[];
  /** Set after the live GitHub discover step (country recipes). */
  liveSource?: "search" | "none";
  liveMessage?: string;
}

export type HomeMode = "scout" | "ask";
