"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Lock, X, Shield, Eye, EyeOff, AlertTriangle, Loader2 } from "lucide-react";
import type { Card } from "@/lib/scoring/types";
import { clientScout, type ClientScoutError } from "@/lib/private/clientScout";

interface Props {
  onClose: () => void;
  onResult: (card: Card) => void;
}

// The private-scout dialog: explains the security model, takes a token + username,
// and runs the scout entirely client-side. The token is held only in a local ref
// (not even React state, so it never serialises), never stored, and sent only to
// api.github.com. Closing the dialog forgets it.
export default function PrivateDialog({ onClose, onResult }: Props) {
  const [username, setUsername] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Token lives in a ref, not state — it's never serialised, never in a snapshot,
  // and the component unmount (dialog close) drops it from memory.
  const tokenRef = useRef("");
  const [tokenDisplay, setTokenDisplay] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    tokenRef.current = e.target.value;
    setTokenDisplay(e.target.value);
  }, []);

  const handleScout = useCallback(async () => {
    const token = tokenRef.current.trim();
    const login = username.trim();
    if (!token || !login) {
      setError("Both a token and a username are required.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const card = await clientScout(login, token);
      onResult(card);
    } catch (e) {
      const err = e as ClientScoutError;
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [username, onResult]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !loading) handleScout();
      if (e.key === "Escape") onClose();
    },
    [handleScout, loading, onClose],
  );

  return (
    // backdrop
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Private scout"
        className="relative mx-4 w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-ink-mute transition hover:text-ink"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/[0.12]">
            <Lock size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-display text-[18px] font-bold text-ink">Private Mode</h2>
            <p className="text-[12.5px] text-ink-soft">Scout with your own GitHub token</p>
          </div>
        </div>

        {/* security explainer */}
        <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold tracking-wide text-ink-faint">
            <Shield size={13} className="text-brand" />
            HOW YOUR TOKEN IS HANDLED
          </div>
          <ul className="space-y-2 text-[12.5px] leading-[1.5] text-ink-soft">
            <li className="flex gap-2">
              <span className="mt-0.5 text-brand">✓</span>
              Sent <strong className="text-ink">only</strong> to <code className="text-[11px] text-amber-400">api.github.com</code> over HTTPS
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-brand">✓</span>
              <strong className="text-ink">Never</strong> sent to GitFut servers, never logged
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-brand">✓</span>
              Kept <strong className="text-ink">only in memory</strong> — closing this dialog forgets it
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 text-brand">✓</span>
              Use a <strong className="text-ink">fine-grained, read-only</strong> token for least privilege
            </li>
          </ul>
        </div>

        {/* token input */}
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-faint">
          GITHUB TOKEN
        </label>
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type={showToken ? "text" : "password"}
            value={tokenDisplay}
            onChange={handleTokenChange}
            placeholder="github_pat_..."
            spellCheck={false}
            autoComplete="off"
            className="h-[42px] w-full rounded-xl border border-white/[0.1] bg-white/[0.03] pl-3 pr-10 font-mono text-[13px] text-ink placeholder-ink-mute outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute transition hover:text-ink"
            tabIndex={-1}
            aria-label={showToken ? "Hide token" : "Show token"}
          >
            {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {/* username input */}
        <label className="mb-1.5 block text-[12px] font-semibold text-ink-faint">
          GITHUB USERNAME
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="octocat"
          spellCheck={false}
          autoComplete="off"
          className="mb-4 h-[42px] w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 font-mono text-[13px] text-ink placeholder-ink-mute outline-none transition focus:border-brand/50 focus:ring-1 focus:ring-brand/30"
        />

        {/* error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2.5 text-[12.5px] text-red-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* actions */}
        <button
          type="button"
          onClick={handleScout}
          disabled={loading}
          className="font-display group relative flex h-[46px] w-full items-center justify-center gap-[9px] overflow-hidden rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 text-[16px] font-bold tracking-[.04em] text-[#1a0e00] shadow-[0_0_0_1px_rgba(245,158,11,.45),0_10px_28px_-6px_rgba(245,158,11,.35)] transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 active:scale-[.985] disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              SCOUTING...
            </>
          ) : (
            <>
              <Lock size={15} />
              SCOUT PRIVATELY
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] text-ink-mute">
          Private cards are shown locally and cannot be shared.
        </p>
      </div>
    </div>
  );
}
