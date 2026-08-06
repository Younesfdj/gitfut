import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("auth session encode/decode", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret-at-least-32-bytes-long!!");
    vi.stubEnv("GITHUB_CLIENT_ID", "cid");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "csec");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("round-trips a session and rejects tampering", async () => {
    const { encodeSession, decodeSession, oauthConfigured, sanitizeReturnTo } =
      await import("@/lib/auth/session");

    expect(oauthConfigured()).toBe(true);
    const raw = encodeSession({ login: "AnshRaj112", accessToken: "gho_x", avatarUrl: "https://a" });
    expect(decodeSession(raw)).toEqual({
      login: "AnshRaj112",
      accessToken: "gho_x",
      avatarUrl: "https://a",
    });
    expect(decodeSession(raw.slice(0, -2) + "aa")).toBeNull();
    expect(sanitizeReturnTo("/alice")).toBe("/alice");
    expect(sanitizeReturnTo("https://evil.com")).toBe("/");
    expect(sanitizeReturnTo("//evil.com")).toBe("/");
  });
});
