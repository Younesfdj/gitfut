import { SAMPLE_CARDS } from "@/lib/github/samples";
import type { Card } from "@/lib/scoring/types";
import { QUERY_CATALOG } from "./catalog";
import { embedText, templateEmbedText } from "./embedder";
import {
  clearTemplates,
  getMeta,
  listCards,
  listTemplates,
  putTemplates,
  setMeta,
  upsertCards,
} from "./idb";
import { CATALOG_VERSION, type StoredTemplate } from "./types";

const META_CATALOG_VERSION = "catalogVersion";
/** Bump when seed policy changes (e.g. dropping demo cards). */
const CARD_SEED_VERSION = 3;
const META_CARDS_SEEDED = "cardsSeeded";
const META_LS_BACKFILL = "localStorageBackfill";

function readLocalStorageCards(): Card[] {
  if (typeof localStorage === "undefined") return [];
  const out: Card[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("gitfut:card:")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const hit = JSON.parse(raw) as { card?: Card };
      if (hit?.card?.login) out.push(hit.card);
    }
  } catch {
    /* private mode / corrupt */
  }
  return out;
}

async function seedTemplates(onProgress?: (msg: string) => void): Promise<StoredTemplate[]> {
  onProgress?.("Indexing scout questions…");
  const stored: StoredTemplate[] = [];
  for (const t of QUERY_CATALOG) {
    const text = templateEmbedText(t);
    const embedding = await embedText(text);
    stored.push({ ...t, embedding, catalogVersion: CATALOG_VERSION });
  }
  await clearTemplates();
  await putTemplates(stored);
  await setMeta(META_CATALOG_VERSION, CATALOG_VERSION);
  return stored;
}

async function ensureTemplates(onProgress?: (msg: string) => void): Promise<StoredTemplate[]> {
  const version = await getMeta(META_CATALOG_VERSION);
  const existing = await listTemplates();
  if (version === CATALOG_VERSION && existing.length === QUERY_CATALOG.length) {
    return existing;
  }
  return seedTemplates(onProgress);
}

async function ensureCardCorpus(): Promise<void> {
  const seeded = await getMeta(META_CARDS_SEEDED);
  if (seeded !== CARD_SEED_VERSION) {
    // Real corpus only: home samples + whatever the user has scouted.
    await upsertCards(SAMPLE_CARDS);
    await setMeta(META_CARDS_SEEDED, CARD_SEED_VERSION);
  }

  const backfilled = await getMeta(META_LS_BACKFILL);
  if (!backfilled) {
    const fromLs = readLocalStorageCards();
    if (fromLs.length) await upsertCards(fromLs);
    await setMeta(META_LS_BACKFILL, true);
  }
}

/**
 * One-shot browser bootstrap: embed catalog into IndexedDB + seed card corpus.
 * Safe to call multiple times; skips work when catalog version matches.
 */
export async function bootstrapScoutAsk(
  onProgress?: (msg: string) => void,
): Promise<{ templates: StoredTemplate[]; cards: Card[] }> {
  onProgress?.("Warming scout brain…");
  const templates = await ensureTemplates(onProgress);
  await ensureCardCorpus();
  const cards = await listCards();
  return { templates, cards };
}
