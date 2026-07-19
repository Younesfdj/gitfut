/** Cosine similarity helpers for in-browser vector search. */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function l2Normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  const mag = Math.sqrt(n);
  if (mag === 0) return v.slice();
  return v.map((x) => x / mag);
}

export interface RankedHit<T> {
  item: T;
  score: number;
}

export function findNearest<T>(
  query: number[],
  items: T[],
  getEmbedding: (item: T) => number[],
  k = 5,
): RankedHit<T>[] {
  const scored = items.map((item) => ({
    item,
    score: cosineSimilarity(query, getEmbedding(item)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, k));
}
