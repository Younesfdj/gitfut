"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, RefreshCw, Trash2 } from "lucide-react";

type EmbedPayload = {
  key: string | null;
  redis: boolean;
  reason?: string;
  embedUrl?: string;
  markdown?: string;
  public?: { embedUrl: string; markdown: string };
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const BTN =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold tracking-wide transition disabled:opacity-45";
const BTN_MUTED = `${BTN} border-white/10 bg-white/[0.03] text-ink-soft hover:border-white/18 hover:bg-white/[0.06] hover:text-ink`;
const BTN_BRAND = `${BTN} border-brand/35 bg-brand/10 text-brand hover:border-brand/55 hover:bg-brand/15`;

function Snippet({ children }: { children: string }) {
  return (
    <pre className="m-0 whitespace-pre-wrap break-all rounded-[10px] border border-white/[0.06] bg-[#0a0c14]/80 px-3 py-2.5 font-mono text-[11px] leading-[1.55] text-ink-dim">
      {children}
    </pre>
  );
}

/** README embed controls for a signed-in owner — auto-mints a private ?k= on load. */
export default function EmbedPanel({ login }: { login: string }) {
  const [data, setData] = useState<EmbedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"rotate" | "revoke" | null>(null);
  const [copied, setCopied] = useState<"public" | "private" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/embed-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.status === 401) {
        setData(null);
        return;
      }
      const json = (await res.json()) as EmbedPayload & { error?: string };
      if (!res.ok && !json.key) {
        setError(json.error || "Couldn't create your private embed link.");
      }
      setData(json);
    } catch {
      setError("Couldn't load embed settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void bootstrap(), 0);
    return () => clearTimeout(t);
  }, [bootstrap]);

  const rotate = async () => {
    if (!confirm("Rotate the private embed key? Old README links with ?k= will fall back to the public card.")) return;
    setBusy("rotate");
    setError(null);
    try {
      const res = await fetch("/api/embed-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate: true }),
      });
      const json = (await res.json()) as EmbedPayload;
      setData(json);
    } catch {
      setError("Couldn't rotate the key.");
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    if (!confirm("Reset the private embed key? Your README will need the new link.")) return;
    setBusy("revoke");
    setError(null);
    try {
      const res = await fetch("/api/embed-key", { method: "DELETE" });
      const json = (await res.json()) as EmbedPayload & { ok?: boolean };
      if (json.ok) await bootstrap();
      else setData(json);
    } catch {
      setError("Couldn't reset the private embed.");
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async (which: "public" | "private", text: string) => {
    if (await copyText(text)) {
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    }
  };

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-[12.5px] text-ink-faint">
        Preparing your README embed links…
      </div>
    );
  }

  if (!data) return null;

  const pubMd =
    data.public?.markdown ??
    `[![My GitFut card](https://gitfut.com/${login}.png)](https://gitfut.com/${login})`;

  return (
    <section className="w-full rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.015] px-5 py-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <header className="mb-4 border-b border-white/[0.06] pb-3.5">
        <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-ink-faint">README EMBED</div>
        <p className="m-0 mt-2 max-w-[68ch] text-[13px] leading-[1.5] text-ink-soft">
          Paste into your GitHub profile README. Public uses open data; private-aware includes what GitFut can see
          after you signed in. Never put a GitHub token in your README.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-ink-dim">Public</span>
            <button type="button" onClick={() => onCopy("public", pubMd)} className={BTN_MUTED}>
              {copied === "public" ? <Check size={12} strokeWidth={2.25} /> : <Copy size={12} strokeWidth={2.25} />}
              {copied === "public" ? "Copied" : "Copy"}
            </button>
          </div>
          <Snippet>{pubMd}</Snippet>
        </div>

        <div>
          {data.key && data.markdown ? (
            <>
              <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-brand">Private-aware</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => onCopy("private", data.markdown!)} className={BTN_BRAND}>
                    {copied === "private" ? (
                      <Check size={12} strokeWidth={2.25} />
                    ) : (
                      <Copy size={12} strokeWidth={2.25} />
                    )}
                    {copied === "private" ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void rotate()}
                    className={BTN_MUTED}
                    title="Rotate key"
                  >
                    <RefreshCw size={12} strokeWidth={2.25} className={busy === "rotate" ? "animate-spin" : ""} />
                    Rotate
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void revoke()}
                    className={BTN_MUTED}
                    title="Mint a new private key"
                  >
                    <Trash2 size={12} strokeWidth={2.25} />
                    Reset
                  </button>
                </div>
              </div>
              <Snippet>{data.markdown}</Snippet>
              {!data.redis ? (
                <p className="m-0 mt-2 text-[11.5px] leading-snug text-ink-faint">
                  No Redis — the key is sealed into the URL (fine locally). Add{" "}
                  <code className="font-mono text-[11px] text-ink-soft">REDIS_URL</code> in production for short keys.
                </p>
              ) : null}
            </>
          ) : (
            <p className="m-0 text-[12.5px] text-ink-faint">Private embed link unavailable.</p>
          )}
        </div>
      </div>

      {error ? <p className="m-0 mt-3 text-[12.5px] text-red-300">{error}</p> : null}
    </section>
  );
}
