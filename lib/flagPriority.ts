import { normalizeCountry } from "./countries";

// The single source of truth for which flag a card shows, by priority:
//   1. override   — a manual pick (report re-select / shared-link ?country=)
//   2. github     — the country derived from the GitHub profile location
//   3. ip         — the viewer's IP-detected country (fallback only)
// Each input is validated/normalised here, so callers can pass raw strings.
// Returns a valid lowercase alpha-2 code or null (no flag).

export function pickFlag(
  override: string | null | undefined,
  github: string | null | undefined,
  ip: string | null | undefined,
): string | null {
  return normalizeCountry(override) ?? normalizeCountry(github) ?? normalizeCountry(ip);
}

/** True when the IP fallback is actually needed (no override, no GitHub flag). */
export function needsIpFallback(
  override: string | null | undefined,
  github: string | null | undefined,
): boolean {
  return !normalizeCountry(override) && !normalizeCountry(github);
}
