import { afterEach, describe, expect, it, vi } from "vitest";
import { countryFromHeaders, getViewerCountry } from "./ipgeo";

// The header path is pure and is the production fast path, so it carries the
// weight of these tests. The fetch fallback is exercised with a stubbed global.

describe("countryFromHeaders", () => {
  it("reads and normalises the Vercel header", () => {
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "US" }))).toBe("us");
  });

  it("reads the Cloudflare header when Vercel's is absent", () => {
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "DE" }))).toBe("de");
  });

  it("prefers the Vercel header when several are present", () => {
    const h = new Headers({ "x-vercel-ip-country": "FR", "cf-ipcountry": "DE" });
    expect(countryFromHeaders(h)).toBe("fr");
  });

  it("accepts a plain record as well as a Headers object", () => {
    expect(countryFromHeaders({ "x-vercel-ip-country": "GB" })).toBe("gb");
  });

  it("accepts any duck-typed header getter (e.g. Next's ReadonlyHeaders)", () => {
    const readonlyHeaders = { get: (n: string) => (n === "cf-ipcountry" ? "IT" : null) };
    expect(countryFromHeaders(readonlyHeaders)).toBe("it");
  });

  it("returns null for missing, blank, or non-shipped codes", () => {
    expect(countryFromHeaders(new Headers())).toBeNull();
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "  " }))).toBeNull();
    // ipapi/edge can return XX/T1 (Tor/unknown) — not a flag we ship.
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "XX" }))).toBeNull();
  });
});

describe("getViewerCountry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("short-circuits on headers without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const req = new Request("https://x", { headers: { "x-vercel-ip-country": "ca" } });
    await expect(getViewerCountry(req)).resolves.toBe("ca");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the IP API when no headers are present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("NL\n", { status: 200 })),
    );
    await expect(getViewerCountry(new Request("https://x"))).resolves.toBe("nl");
  });

  it("returns null when the IP API fails or returns junk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    await expect(getViewerCountry(new Request("https://x"))).resolves.toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Undefined", { status: 200 })),
    );
    await expect(getViewerCountry(new Request("https://x"))).resolves.toBeNull();
  });
});
