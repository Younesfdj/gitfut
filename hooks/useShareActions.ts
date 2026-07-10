"use client";

import { useEffect, useRef, useState } from "react";

// Client wiring for the share row, shared by CardActions and DuelView. The DATA
// (payload strings, intent URLs) lives in lib/share; this hook owns only the
// gestures.
export function useShareActions({
  getSharePayload,
  getIntentUrl,
  getCopyUrl,
}: {
  /** What to hand navigator.share — may be async (e.g. render a file first). */
  getSharePayload: () => ShareData | Promise<ShareData>;
  /** Fallback web-intent URL opened when native share is unavailable/fails. */
  getIntentUrl: () => string;
  /** URL written to the clipboard by copyLink. */
  getCopyUrl: () => string;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  // Default FALSE: desktop (no Web Share) must never flash the CTA — the SSR
  // HTML and first paint simply don't contain it. Supported platforms reveal
  // it right after hydration, a frame nobody sees inside the page's load
  // animations. (Default-true was tried and flashes on every desktop refresh.)
  const [canNativeShare, setCanNativeShare] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" && typeof navigator.share === "function";
    if (!supported) return;
    // Deferred (not synchronous in the effect) so it can't cascade renders.
    const t = setTimeout(() => setCanNativeShare(true), 0);
    return () => clearTimeout(t);
  }, []);

  const nativeShare = async () => {
    try {
      await navigator.share(await getSharePayload());
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // user dismissed
      window.open(getIntentUrl(), "_blank", "noopener,noreferrer");
    }
  };

  // Returns whether the write landed, so callers that show their own feedback
  // (CardActions) never flash "copied" over a failed write; DuelView ignores
  // the result and reads `linkCopied`, which only flips on success anyway.
  const copyLink = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(getCopyUrl());
      setLinkCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setLinkCopied(false), 1600);
      return true;
    } catch {
      return false; // clipboard unavailable
    }
  };

  return { canNativeShare, nativeShare, copyLink, linkCopied };
}
