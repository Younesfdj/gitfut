import { EMBEDDING_DIM } from "./types";
import { l2Normalize } from "./cosine";

type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Lazy-load Xenova all-MiniLM-L6-v2 in the browser (same model as PREPAIDplus Thato).
 * Dynamic import keeps this out of the server bundle.
 */
export async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (typeof window === "undefined") {
    throw new Error("Embedder is browser-only");
  }
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return (await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      )) as FeatureExtractionPipeline;
    })();
  }
  return pipelinePromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getEmbedder();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const raw = Array.from(output.data as ArrayLike<number>);
  if (raw.length !== EMBEDDING_DIM) {
    // Some builds return unpooled tokens; mean-pool defensively.
    if (raw.length % EMBEDDING_DIM === 0 && raw.length > EMBEDDING_DIM) {
      const tokens = raw.length / EMBEDDING_DIM;
      const pooled = new Array<number>(EMBEDDING_DIM).fill(0);
      for (let t = 0; t < tokens; t++) {
        for (let d = 0; d < EMBEDDING_DIM; d++) {
          pooled[d]! += raw[t * EMBEDDING_DIM + d]!;
        }
      }
      for (let d = 0; d < EMBEDDING_DIM; d++) pooled[d]! /= tokens;
      return l2Normalize(pooled);
    }
    throw new Error(`Unexpected embedding length ${raw.length}`);
  }
  return l2Normalize(raw);
}

/** Text used when indexing a query template (mirrors PREPAIDplus title+desc+query). */
export function templateEmbedText(parts: {
  title: string;
  description: string;
  queryTemplate: string;
}): string {
  return [parts.title, parts.description, parts.queryTemplate].filter(Boolean).join("\n");
}
