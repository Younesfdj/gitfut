import "server-only";
import Redis from "ioredis";

// One shared connection, stashed on globalThis so dev HMR doesn't leak sockets.
declare global {
  var __gitfutRedis: Redis | null | undefined;
}

function create(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new Redis(url, {
    // The VPS Redis presents a self-signed cert — keep TLS encryption but skip
    // chain verification (the traffic is still encrypted end to end).
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: 2,
    commandTimeout: 2000,
  });
  client.on("error", (e) => console.error("[redis]", e.message));
  return client;
}

export const redis: Redis | null =
  globalThis.__gitfutRedis !== undefined ? globalThis.__gitfutRedis : (globalThis.__gitfutRedis = create());
