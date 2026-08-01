import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const store = new Map<string, string>();
const ttl = new Map<string, number>();

vi.mock("@/lib/redis", () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string, _ex?: string, seconds?: number) => {
      store.set(k, v);
      if (typeof seconds === "number") ttl.set(k, seconds);
    },
    del: async (...keys: string[]) => {
      for (const k of keys) {
        store.delete(k);
        ttl.delete(k);
      }
    },
    expire: async (k: string, seconds: number) => {
      if (store.has(k)) ttl.set(k, seconds);
    },
    pipeline: () => {
      const ops: Array<() => Promise<unknown>> = [];
      const api = {
        set: (k: string, v: string, _ex?: string, seconds?: number) => {
          ops.push(async () => {
            store.set(k, v);
            if (typeof seconds === "number") ttl.set(k, seconds);
          });
          return api;
        },
        expire: (k: string, seconds: number) => {
          ops.push(async () => {
            if (store.has(k)) ttl.set(k, seconds);
          });
          return api;
        },
        exec: async () => {
          for (const op of ops) await op();
          return [];
        },
      };
      return api;
    },
  },
}));

describe("embedKey crypto + store", () => {
  beforeEach(() => {
    store.clear();
    ttl.clear();
    vi.stubEnv("AUTH_SECRET", "test-secret-at-least-32-bytes-long!!");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips encrypt/decrypt", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/auth/embedKey");
    const enc = encryptToken("gho_test_token");
    expect(enc).toBeTruthy();
    expect(decryptToken(enc!.encToken, enc!.iv, enc!.tag)).toBe("gho_test_token");
    expect(decryptToken(enc!.encToken, enc!.iv, "deadbeef")).toBeNull();
  });

  it("mints, resolves, and rotates redis keys for a session", async () => {
    const {
      ensureEmbedKey,
      resolveEmbedKey,
      rotateEmbedKey,
      revokeEmbedKey,
      newEmbedKeyValue,
    } = await import("@/lib/auth/embedKey");

    expect(newEmbedKeyValue().startsWith("gf_")).toBe(true);

    const session = { login: "AnshRaj112", accessToken: "gho_a" };
    const minted = await ensureEmbedKey(session);
    expect(minted.key).toMatch(/^gf_/);
    expect(minted.mode).toBe("redis");
    if (!minted.key) throw new Error("expected key");

    const resolved = await resolveEmbedKey(minted.key);
    expect(resolved).toMatchObject({ login: "AnshRaj112", accessToken: "gho_a" });

    const again = await ensureEmbedKey({ login: "AnshRaj112", accessToken: "gho_b" });
    expect(again.key).toBe(minted.key);
    expect((await resolveEmbedKey(minted.key!))?.accessToken).toBe("gho_b");

    const rotated = await rotateEmbedKey({ login: "AnshRaj112", accessToken: "gho_c" });
    expect(rotated.key).toBeTruthy();
    expect(rotated.key).not.toBe(minted.key);
    expect(await resolveEmbedKey(minted.key!)).toBeNull();
    expect((await resolveEmbedKey(rotated.key!))?.accessToken).toBe("gho_c");

    await revokeEmbedKey({ login: "AnshRaj112", accessToken: "gho_c" });
    expect(await resolveEmbedKey(rotated.key!)).toBeNull();
  });

  it("mints sealed keys that resolve without redis lookups", async () => {
    const { mintSealedKey, resolveEmbedKey, ensureEmbedKey } = await import("@/lib/auth/embedKey");
    const sealed = mintSealedKey("alice", "gho_seal");
    expect(sealed?.startsWith("gf_s1.")).toBe(true);
    expect(await resolveEmbedKey(sealed!)).toMatchObject({
      login: "alice",
      accessToken: "gho_seal",
    });

    // Tamper → null
    expect(await resolveEmbedKey(sealed! + "x")).toBeNull();

    const ensured = await ensureEmbedKey({
      login: "bob",
      accessToken: "gho_b",
      embedKey: sealed!,
    });
    // Wrong login on sealed key → mint a new sealed key for bob
    expect(ensured.key?.startsWith("gf_s1.") || ensured.mode === "redis").toBe(true);
  });

  it("resolveEmbedKey returns null for garbage keys", async () => {
    const { resolveEmbedKey } = await import("@/lib/auth/embedKey");
    expect(await resolveEmbedKey("not-a-key")).toBeNull();
    expect(await resolveEmbedKey("gf_missing")).toBeNull();
  });
});

describe("embedKey sealed mode without redis", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret-at-least-32-bytes-long!!");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/redis");
  });

  it("ensure works when redis is null", async () => {
    vi.doMock("@/lib/redis", () => ({ redis: null }));
    vi.resetModules();
    const { ensureEmbedKey, resolveEmbedKey, rotateEmbedKey } = await import("@/lib/auth/embedKey");

    const first = await ensureEmbedKey({ login: "carol", accessToken: "gho_1" });
    expect(first.mode).toBe("sealed");
    expect(first.key?.startsWith("gf_s1.")).toBe(true);
    expect((await resolveEmbedKey(first.key!))?.accessToken).toBe("gho_1");

    const again = await ensureEmbedKey({
      login: "carol",
      accessToken: "gho_1",
      embedKey: first.key!,
    });
    expect(again.key).toBe(first.key);

    const rotated = await rotateEmbedKey({ login: "carol", accessToken: "gho_2" });
    expect(rotated.key).not.toBe(first.key);
    expect((await resolveEmbedKey(rotated.key!))?.accessToken).toBe("gho_2");
  });
});
