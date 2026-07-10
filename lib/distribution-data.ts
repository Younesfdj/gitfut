// Rating histogram from a uniform random sample of GitHub accounts, scored
// with this repo's own engine. The data lives in data/distribution-data.json;
// regenerate it with scripts/distribution-runner.ts. This module only
// types and re-exports it so components keep a stable import.
import dist from "../data/distribution-data.json";

// Ratings below DIST_MIN are clamped into the first bucket.
export const DIST_MIN: number = dist.min;
// Date the sample was taken (the engine evolves; counts are a snapshot).
export const DIST_DATE: string = dist.date;
// All sampled accounts: DIST_N in total, of which DIST_COUNTS[i] have
// overall rating DIST_MIN + i.
export const DIST_N: number = dist.n;
export const DIST_COUNTS: number[] = dist.counts;
// Same sample, restricted to accounts with >= 1 contribution in the past year.
export const DIST_ACTIVE_N: number = dist.activeN;
export const DIST_ACTIVE_COUNTS: number[] = dist.activeCounts;
