"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n/useLocale";
import { useUIDict } from "@/lib/i18n/hooks";

// Last-resort boundary: a throw in the root layout itself escapes app/error.tsx,
// so this replaces the entire document (it must render its own <html>/<body>).
// It can't rely on the layout's fonts, globals.css tokens or <Background>, so it's
// intentionally self-contained with inline styles in the brand palette
// (bg #02001e, GitHub green #39d353).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[gitfut] global error:", error);
  }, [error]);

  // GlobalError renders before the LocaleProvider mounts, so useLocale() may
  // not have a value. Fall back to ENGLISH silently — global errors are rare
  // and the user can still resolve the message.
  const locale = useLocale();
  const ui = useUIDict().errors;
  void locale;

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#02001e",
          color: "#e6edf3",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.3em", color: "#39d353" }}>GITFUT</div>
          <h1 style={{ margin: "14px 0 0", fontSize: 34, fontWeight: 800, lineHeight: 1.05 }}>{ui.globalTitle}</h1>
          <p style={{ margin: "14px 0 0", fontSize: 15.5, lineHeight: 1.5, color: "#a8b3bd" }}>
            {ui.globalBody}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 28,
              height: 46,
              padding: "0 24px",
              border: 0,
              borderRadius: 12,
              background: "#39d353",
              color: "#04130a",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            {locale === "ko" ? "새로고침" : "RELOAD"}
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: 22,
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "#6e7681",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
