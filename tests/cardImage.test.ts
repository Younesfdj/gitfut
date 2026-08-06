import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scoutCard = vi.fn();
const resolveEmbedKey = vi.fn();
const touchEmbedKey = vi.fn();
const renderCardImage = vi.fn(async (card: unknown, opts?: { privateAware?: boolean }) => {
  return new Response(JSON.stringify({ card, opts }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

vi.mock("@/lib/scout", () => ({ scoutCard: (...a: unknown[]) => scoutCard(...a) }));
vi.mock("@/lib/auth/embedKey", () => ({
  resolveEmbedKey: (...a: unknown[]) => resolveEmbedKey(...a),
  touchEmbedKey: (...a: unknown[]) => touchEmbedKey(...a),
}));
vi.mock("@/lib/og/renderCard", () => ({
  renderCardImage: (...a: unknown[]) => renderCardImage(...a),
}));
vi.mock("@/lib/flagPriority", () => ({
  pickFlag: (_o: string | null, c: string) => c || "",
}));
vi.mock("@/lib/og/card", () => ({ loadCardFonts: async () => [] }));

describe("card-image private embed ?k=", () => {
  beforeEach(() => {
    scoutCard.mockReset();
    resolveEmbedKey.mockReset();
    touchEmbedKey.mockReset();
    renderCardImage.mockClear();
    scoutCard.mockResolvedValue({ login: "alice", country: "", privateAware: false });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("scouts publicly when no k is present", async () => {
    const { GET } = await import("@/app/api/card-image/[username]/route");
    await GET(new Request("http://localhost/api/card-image/alice"), {
      params: Promise.resolve({ username: "alice" }),
    });
    expect(resolveEmbedKey).not.toHaveBeenCalled();
    expect(scoutCard).toHaveBeenCalledWith("alice", undefined);
    expect(renderCardImage).toHaveBeenCalledWith(
      expect.objectContaining({ login: "alice" }),
      { privateAware: false },
    );
  });

  it("uses viewer token when k matches the username", async () => {
    resolveEmbedKey.mockResolvedValue({
      login: "alice",
      accessToken: "gho_x",
      key: "gf_abc",
    });
    scoutCard.mockResolvedValue({ login: "alice", country: "", privateAware: true });

    const { GET } = await import("@/app/api/card-image/[username]/route");
    await GET(new Request("http://localhost/api/card-image/alice?k=gf_abc"), {
      params: Promise.resolve({ username: "alice" }),
    });

    expect(resolveEmbedKey).toHaveBeenCalledWith("gf_abc");
    expect(scoutCard).toHaveBeenCalledWith("alice", {
      viewerLogin: "alice",
      viewerToken: "gho_x",
    });
    expect(touchEmbedKey).toHaveBeenCalledWith("gf_abc");
    expect(renderCardImage).toHaveBeenCalledWith(
      expect.objectContaining({ login: "alice" }),
      { privateAware: true },
    );
  });

  it("falls back to public when k belongs to a different user", async () => {
    resolveEmbedKey.mockResolvedValue({
      login: "bob",
      accessToken: "gho_x",
      key: "gf_abc",
    });

    const { GET } = await import("@/app/api/card-image/[username]/route");
    await GET(new Request("http://localhost/api/card-image/alice?k=gf_abc"), {
      params: Promise.resolve({ username: "alice" }),
    });

    expect(scoutCard).toHaveBeenCalledWith("alice", undefined);
    expect(touchEmbedKey).not.toHaveBeenCalled();
    expect(renderCardImage).toHaveBeenCalledWith(expect.anything(), { privateAware: false });
  });
});
