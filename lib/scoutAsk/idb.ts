import type { Card } from "@/lib/scoring/types";
import { DB_NAME, DB_VERSION, type StoredTemplate } from "./types";

const STORE_TEMPLATES = "templates";
const STORE_CARDS = "cards";
const STORE_META = "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        db.createObjectStore(STORE_CARDS, { keyPath: "login" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function getMeta(key: string): Promise<unknown> {
  const db = await openDb();
  try {
    const row = await reqToPromise<{ key: string; value: unknown } | undefined>(
      db.transaction(STORE_META, "readonly").objectStore(STORE_META).get(key),
    );
    return row?.value;
  } finally {
    db.close();
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put({ key, value });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function putTemplates(templates: StoredTemplate[]): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_TEMPLATES, "readwrite");
    const store = tx.objectStore(STORE_TEMPLATES);
    for (const t of templates) store.put(t);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function clearTemplates(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_TEMPLATES, "readwrite");
    tx.objectStore(STORE_TEMPLATES).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function listTemplates(): Promise<StoredTemplate[]> {
  const db = await openDb();
  try {
    return await reqToPromise(
      db.transaction(STORE_TEMPLATES, "readonly").objectStore(STORE_TEMPLATES).getAll(),
    );
  } finally {
    db.close();
  }
}

export async function upsertCard(card: Card): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_CARDS, "readwrite");
    // Normalize login key to lowercase for stable lookups.
    tx.objectStore(STORE_CARDS).put({ ...card, login: card.login });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function upsertCards(cards: Card[]): Promise<void> {
  if (cards.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_CARDS, "readwrite");
    const store = tx.objectStore(STORE_CARDS);
    for (const card of cards) store.put(card);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function listCards(): Promise<Card[]> {
  const db = await openDb();
  try {
    return await reqToPromise(
      db.transaction(STORE_CARDS, "readonly").objectStore(STORE_CARDS).getAll(),
    );
  } finally {
    db.close();
  }
}
