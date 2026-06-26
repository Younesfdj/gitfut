// Best-effort viewer country from the request, ISO 3166-1 alpha-2 (lowercase),
// or null. This only PRE-FILLS the country picker — it never blocks scouting and
// is always overridable, so "wrong" is cheap and null is fine.
//
// Order of preference:
//   1. Edge/CDN geo headers (Vercel/Cloudflare) — free, instant, no egress.
//   2. A single IP-geo API call (ipapi.co) as a dev/non-edge fallback.
// Everything is validated against the flags we actually ship.

import { normalizeCountry } from "./countries";

// Header names carrying the country resolved by the platform's edge. Limited to
// headers our infrastructure provably injects (and strips from inbound requests)
// — a generic, client-settable header would be trivially spoofable.
const GEO_HEADERS = [
  "x-vercel-ip-country", // Vercel edge
  "cf-ipcountry", // Cloudflare edge
] as const;

// Anything exposing a header getter: the WHATWG `Headers`, Next's
// `ReadonlyHeaders`, etc. (duck-typed so we don't depend on identity).
type HeaderGetter = { get(name: string): string | null };
type HeaderLike = HeaderGetter | Record<string, string | string[] | undefined>;

const hasGet = (h: HeaderLike): h is HeaderGetter => typeof (h as HeaderGetter).get === "function";

/**
 * Read a country from edge geo headers. Pure and synchronous — no network — so
 * it's the fast path and the part we unit-test. Returns a valid lowercase code
 * or null. Accepts anything header-like (Headers, ReadonlyHeaders, or a plain
 * record).
 */
export function countryFromHeaders(headers: HeaderLike): string | null {
  const get = (name: string): string | null => {
    const raw = hasGet(headers) ? headers.get(name) : headers[name] ?? headers[name.toLowerCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? value.trim() : null;
  };
  for (const name of GEO_HEADERS) {
    const code = normalizeCountry(get(name));
    if (code) return code;
  }
  return null;
}

// ipapi.co allows token-less HTTPS lookups at a low rate — fine for local dev
// and the rare edge miss. Never trusted blindly: the result is validated.
const IPAPI_URL = "https://ipapi.co/country/";
const FETCH_TIMEOUT_MS = 1500;

async function countryFromIpApi(): Promise<string | null> {
  try {
    const res = await fetch(IPAPI_URL, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.text()).trim();
    return normalizeCountry(body);
  } catch {
    // Timeout, network error, rate limit — pre-fill is optional, so swallow.
    return null;
  }
}

/**
 * Resolve the viewer's country for picker pre-fill. Tries edge headers first
 * (covers production), then one ipapi.co lookup (covers local dev). Always
 * returns a valid lowercase code or null — callers must treat null as "unknown".
 */
export async function getViewerCountry(req: Request): Promise<string | null> {
  const fromHeaders = countryFromHeaders(req.headers);
  if (fromHeaders) return fromHeaders;
  return countryFromIpApi();
}
