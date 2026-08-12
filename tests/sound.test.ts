import { beforeEach, describe, expect, it } from "vitest";
import { isMuted, playRevealChime, setMuted } from "@/lib/sound";

// The test environment is plain node (see vitest.config.ts) — no DOM, so no
// global `localStorage`. A minimal in-memory stand-in is enough to exercise
// the isMuted/setMuted read-write path the same way a browser would.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}
globalThis.localStorage = new MemoryStorage();

describe("mute preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to unmuted", () => {
    expect(isMuted()).toBe(false);
  });

  it("round-trips through setMuted/isMuted", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });
});

describe("playRevealChime", () => {
  it("does not throw without a browser AudioContext (node test environment)", () => {
    expect(() => playRevealChime("bronze", false)).not.toThrow();
    expect(() => playRevealChime("icon", true)).not.toThrow();
  });

  it("no-ops silently when muted", () => {
    setMuted(true);
    expect(() => playRevealChime("toty", true)).not.toThrow();
  });
});
