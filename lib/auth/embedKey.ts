import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { redis } from "@/lib/redis";
import type { Session } from "./session";

// Opaque GitFut embed keys for private-aware README PNGs (`/<user>.png?k=…`).
// Never a GitHub PAT — the owner's OAuth access token is AES-GCM encrypted under
// AUTH_SECRET so cookie-less image fetches can rebuild a private-aware card.
//
// Two modes:
//   Redis (preferred): short gf_… pointer; instant rotate/revoke.
//   Sealed (no Redis): gf_s1.<payload>.<mac> carries ciphertext in the URL itself
//   so local/dev works with only AUTH_SECRET. Revoke can't kill old URLs until expiry.

const VERSION = "v1";
const KEY_PREFIX = "gf_";
const SEALED_PREFIX = "gf_s1.";
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://gitfut.com";

export function embedRedisAvailable(): boolean {
  return !!redis;
}

function kKey(k: string) {
  return `gitfut:embed:${VERSION}:k:${k}`;
}
function loginKey(login: string) {
  return `gitfut:embed:${VERSION}:login:${login.toLowerCase()}`;
}

function authSecret(): string | null {
  return process.env.AUTH_SECRET?.trim() || null;
}

/** 32-byte AES key derived from AUTH_SECRET (stable across deploys). */
function aesKey(): Buffer | null {
  const secret = authSecret();
  if (!secret) return null;
  return createHash("sha256").update(`gitfut-embed-token:${secret}`).digest();
}

export function encryptToken(accessToken: string): { encToken: string; iv: string; tag: string } | null {
  const key = aesKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encToken: enc.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
  };
}

export function decryptToken(encToken: string, iv: string, tag: string): string | null {
  const key = aesKey();
  if (!key) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encToken, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function newEmbedKeyValue(): string {
  return KEY_PREFIX + randomBytes(32).toString("base64url");
}

interface StoredEmbed {
  login: string;
  encToken: string;
  iv: string;
  tag: string;
  createdAt: number;
}

interface SealedPayload {
  l: string; // login
  e: string; // encToken
  i: string; // iv
  t: string; // tag
  x: number; // expiry ms
}

export interface ResolvedEmbed {
  login: string;
  accessToken: string;
  key: string;
}

export interface EmbedKeyPublic {
  key: string;
  embedUrl: string;
  markdown: string;
  /** True when the short Redis-backed key is in use. */
  redis: boolean;
  mode: "redis" | "sealed";
}

export interface EmbedKeyUnavailable {
  key: null;
  redis: boolean;
  reason?: "no_auth_secret" | "none";
}

function publicUrls(login: string, key: string): Pick<EmbedKeyPublic, "embedUrl" | "markdown"> {
  const embedUrl = `${SITE}/${login}.png?k=${encodeURIComponent(key)}`;
  const pageUrl = `${SITE}/${login}`;
  const markdown = `[![My GitFut card](${embedUrl})](${pageUrl})`;
  return { embedUrl, markdown };
}

export function publicEmbedMarkdown(login: string): { embedUrl: string; markdown: string } {
  const embedUrl = `${SITE}/${login}.png`;
  const pageUrl = `${SITE}/${login}`;
  return {
    embedUrl,
    markdown: `[![My GitFut card](${embedUrl})](${pageUrl})`,
  };
}

function signSealedBody(body: string): string {
  return createHmac("sha256", authSecret()!).update(body).digest("base64url");
}

/** Self-contained key: ciphertext + expiry live in the URL (no Redis). */
export function mintSealedKey(login: string, accessToken: string): string | null {
  if (!authSecret() || !aesKey()) return null;
  const enc = encryptToken(accessToken);
  if (!enc) return null;
  const payload: SealedPayload = {
    l: login,
    e: enc.encToken,
    i: enc.iv,
    t: enc.tag,
    x: Date.now() + TTL_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${SEALED_PREFIX}${body}.${signSealedBody(body)}`;
}

function resolveSealedKey(k: string): ResolvedEmbed | null {
  if (!authSecret() || !k.startsWith(SEALED_PREFIX)) return null;
  const rest = k.slice(SEALED_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = rest.slice(0, dot);
  const mac = rest.slice(dot + 1);
  const expected = signSealedBody(body);
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SealedPayload;
    if (!payload?.l || !payload.e || !payload.i || !payload.t || !payload.x) return null;
    if (Date.now() > payload.x) return null;
    const accessToken = decryptToken(payload.e, payload.i, payload.t);
    if (!accessToken) return null;
    return { login: payload.l, accessToken, key: k };
  } catch {
    return null;
  }
}

async function writeRedisEmbed(login: string, key: string, accessToken: string): Promise<EmbedKeyPublic | null> {
  if (!redis) return null;
  const enc = encryptToken(accessToken);
  if (!enc) return null;
  const record: StoredEmbed = {
    login,
    encToken: enc.encToken,
    iv: enc.iv,
    tag: enc.tag,
    createdAt: Date.now(),
  };
  const loginNorm = login.toLowerCase();
  const prevRaw = await redis.get(loginKey(loginNorm));
  if (prevRaw) {
    try {
      const prev = JSON.parse(prevRaw) as { k?: string };
      if (prev.k && prev.k !== key) await redis.del(kKey(prev.k));
    } catch {
      /* ignore */
    }
  }
  const pipe = redis.pipeline();
  pipe.set(kKey(key), JSON.stringify(record), "EX", TTL_SECONDS);
  pipe.set(loginKey(loginNorm), JSON.stringify({ k: key }), "EX", TTL_SECONDS);
  await pipe.exec();
  return { key, redis: true, mode: "redis", ...publicUrls(login, key) };
}

function sealedPublic(login: string, key: string): EmbedKeyPublic {
  return { key, redis: false, mode: "sealed", ...publicUrls(login, key) };
}

export async function getEmbedForLogin(
  login: string,
  sessionEmbedKey?: string | null,
): Promise<EmbedKeyPublic | EmbedKeyUnavailable> {
  if (!aesKey()) return { key: null, redis: !!redis, reason: "no_auth_secret" };

  if (redis) {
    try {
      const raw = await redis.get(loginKey(login));
      if (raw) {
        const { k } = JSON.parse(raw) as { k?: string };
        if (k) {
          const rec = await redis.get(kKey(k));
          if (rec) return { key: k, redis: true, mode: "redis", ...publicUrls(login, k) };
        }
      }
    } catch (e) {
      console.error("[embed] get failed:", (e as Error).message);
    }
  }

  // No Redis (or no redis record): reuse sealed key from the session cookie if still valid.
  if (sessionEmbedKey) {
    const resolved = resolveSealedKey(sessionEmbedKey);
    if (resolved && resolved.login.toLowerCase() === login.toLowerCase()) {
      return sealedPublic(login, sessionEmbedKey);
    }
  }

  return { key: null, redis: !!redis, reason: "none" };
}

/** Mint if missing; otherwise return existing and refresh token material. */
export async function ensureEmbedKey(session: Session): Promise<EmbedKeyPublic | EmbedKeyUnavailable> {
  if (!aesKey()) return { key: null, redis: !!redis, reason: "no_auth_secret" };

  if (redis) {
    const existing = await getEmbedForLogin(session.login);
    if (existing.key && existing.mode === "redis") {
      const refreshed = await writeRedisEmbed(session.login, existing.key, session.accessToken);
      return refreshed ?? existing;
    }
    const key = newEmbedKeyValue();
    const minted = await writeRedisEmbed(session.login, key, session.accessToken);
    if (minted) return minted;
  }

  // Sealed fallback (local without REDIS_URL, or Redis write failed).
  if (session.embedKey) {
    const resolved = resolveSealedKey(session.embedKey);
    if (resolved && resolved.login.toLowerCase() === session.login.toLowerCase()) {
      return sealedPublic(session.login, session.embedKey);
    }
  }
  const sealed = mintSealedKey(session.login, session.accessToken);
  if (!sealed) return { key: null, redis: !!redis, reason: "no_auth_secret" };
  return sealedPublic(session.login, sealed);
}

export async function rotateEmbedKey(session: Session): Promise<EmbedKeyPublic | EmbedKeyUnavailable> {
  if (!aesKey()) return { key: null, redis: !!redis, reason: "no_auth_secret" };

  if (redis) {
    const key = newEmbedKeyValue();
    const minted = await writeRedisEmbed(session.login, key, session.accessToken);
    if (minted) return minted;
  }

  const sealed = mintSealedKey(session.login, session.accessToken);
  if (!sealed) return { key: null, redis: !!redis, reason: "no_auth_secret" };
  return sealedPublic(session.login, sealed);
}

export async function revokeEmbedKey(session: Session): Promise<{ ok: true } | EmbedKeyUnavailable> {
  if (redis) {
    try {
      const loginNorm = session.login.toLowerCase();
      const raw = await redis.get(loginKey(loginNorm));
      if (raw) {
        try {
          const { k } = JSON.parse(raw) as { k?: string };
          if (k) await redis.del(kKey(k));
        } catch {
          /* ignore */
        }
      }
      await redis.del(loginKey(loginNorm));
    } catch (e) {
      console.error("[embed] revoke failed:", (e as Error).message);
      return { key: null, redis: true, reason: "none" };
    }
  }
  // Sealed keys can't be killed server-side without Redis; clearing session.embedKey
  // (caller) stops showing them. Old README URLs work until the sealed expiry.
  return { ok: true };
}

/** Resolve a README `?k=` to login + access token. Wrong/missing → null. */
export async function resolveEmbedKey(k: string): Promise<ResolvedEmbed | null> {
  if (!k) return null;
  if (k.startsWith(SEALED_PREFIX)) return resolveSealedKey(k);
  if (!redis || !k.startsWith(KEY_PREFIX)) return null;
  try {
    const raw = await redis.get(kKey(k));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredEmbed;
    if (!stored?.login || !stored.encToken || !stored.iv || !stored.tag) return null;
    const accessToken = decryptToken(stored.encToken, stored.iv, stored.tag);
    if (!accessToken) return null;
    return { login: stored.login, accessToken, key: k };
  } catch (e) {
    console.error("[embed] resolve failed:", (e as Error).message);
    return null;
  }
}

/** Extend TTL after a successful private PNG scout (Redis keys only). */
export async function touchEmbedKey(k: string): Promise<void> {
  if (!redis || k.startsWith(SEALED_PREFIX)) return;
  try {
    const raw = await redis.get(kKey(k));
    if (!raw) return;
    const stored = JSON.parse(raw) as StoredEmbed;
    const pipe = redis.pipeline();
    pipe.expire(kKey(k), TTL_SECONDS);
    pipe.expire(loginKey(stored.login), TTL_SECONDS);
    await pipe.exec();
  } catch (e) {
    console.error("[embed] touch failed:", (e as Error).message);
  }
}
