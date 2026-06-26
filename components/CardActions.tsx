"use client";

import { useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { Check, Copy, Download, Link2, MessageCircle, Share2 } from "lucide-react";
import type { Card } from "@/lib/scoring/types";
import { cardUrl, intentUrl, nativeSharePayload } from "@/lib/share";
import { RESULT_THEME } from "./finishTheme";

const RENDER_OPTS = { pixelRatio: 3, cacheBust: true } as const;

function XLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

interface ExportAction {
  id: string;
  label: string;
  title: string;
  done: string;
  icon: typeof Download;
  run: (node: HTMLElement, card: Card) => Promise<void>;
}

const EXPORTS: ExportAction[] = [
  {
    id: "download",
    label: "Download",
    title: "Download as PNG",
    done: "Saved",
    icon: Download,
    run: async (node, card) => {
      const url = await toPng(node, RENDER_OPTS);
      const a = document.createElement("a");
      a.download = `${card.login}-gitfut.png`;
      a.href = url;
      a.click();
    },
  },
  {
    id: "copy",
    label: "Copy",
    title: "Copy image to clipboard",
    done: "Copied",
    icon: Copy,
    run: async (node) => {
      const blob = await toBlob(node, RENDER_OPTS);
      if (!blob) throw new Error("render returned no image");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    },
  },
  {
    id: "link",
    label: "Link",
    title: "Copy link to this card",
    done: "Copied",
    icon: Link2,
    run: async (_node, card) => {
      await navigator.clipboard.writeText(cardUrl(card));
    },
  },
];

// Each platform carries its own brand color, surfaced on hover so the buttons
// feel recognizable and tappable (not three identical grey tabs).
const PLATFORMS = [
  { id: "x" as const, label: "X", brand: "#ffffff", Icon: XLogo },
  { id: "linkedin" as const, label: "LinkedIn", brand: "#0a66c2", Icon: LinkedInLogo },
  {
    id: "whatsapp" as const,
    label: "WhatsApp",
    brand: "#25d366",
    Icon: (p: { size?: number }) => <MessageCircle size={p.size ?? 16} />,
  },
];

export default function CardActions({
  card,
  targetRef,
}: {
  card: Card;
  targetRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Download CTA picks up the card's own tier color so the action matches the
  // card the user is saving (bronze → bronze, silver → silver, TOTY → blue …).
  const tier = RESULT_THEME[card.finish].ink;

  const runExport = async (a: ExportAction) => {
    const node = targetRef.current;
    if (!node || busy) return;
    setBusy(a.id);
    setError(null);
    try {
      await document.fonts.ready; // local FUT fonts must be loaded before capture
      await a.run(node, card);
      setDone(a.id);
      setTimeout(() => setDone((d) => (d === a.id ? null : d)), 1500);
    } catch (e) {
      console.error("[gitfut] card export failed:", e);
      setError(`${a.label} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  // Native share sheet — the smoothest path on mobile (and the only route to
  // Instagram Stories). Tries to attach the card image; falls back to X intent.
  const nativeShare = async () => {
    const node = targetRef.current;
    const payload = nativeSharePayload(card);
    try {
      if (node && typeof navigator !== "undefined" && "canShare" in navigator) {
        const blob = await toBlob(node, RENDER_OPTS);
        if (blob) {
          const file = new File([blob], `${card.login}-gitfut.png`, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ ...payload, files: [file] });
            return;
          }
        }
      }
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(payload);
        return;
      }
      window.open(intentUrl("x", card), "_blank", "noopener,noreferrer");
    } catch (e) {
      // user-cancelled share is benign — no error toast
      if (e instanceof Error && e.name === "AbortError") return;
      window.open(intentUrl("x", card), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex w-full flex-col gap-[10px]">
      {/* primary — native share sheet (green = the action). Focal CTA: lifts on
          hover, presses on click, with a one-pass sheen sweep on hover. */}
      <button
        onClick={nativeShare}
        className="font-display group relative flex h-[50px] w-full items-center justify-center gap-[9px] overflow-hidden rounded-xl bg-gradient-to-b from-brand to-brand-mid text-[18px] tracking-[.05em] text-[#04130a] shadow-[0_0_0_1px_rgba(57,211,83,.45),0_10px_28px_-6px_rgba(57,211,83,.5)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_0_0_1px_rgba(86,224,107,.6),0_14px_34px_-6px_rgba(57,211,83,.62)] active:translate-y-0 active:scale-[.985] active:duration-75"
      >
        {/* sheen sweep on hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
        <Share2 size={18} strokeWidth={2.5} className="relative" />
        <span className="relative">SHARE MY CARD</span>
      </button>

      {/* platform row — three distinct CTAs; each lights up in its own brand
          color on hover (lift + tinted fill + border) so it reads as tappable */}
      <div className="grid w-full grid-cols-3 gap-[8px]">
        {PLATFORMS.map((p) => {
          const { Icon } = p;
          return (
            <button
              key={p.id}
              onClick={() => window.open(intentUrl(p.id, card), "_blank", "noopener,noreferrer")}
              title={`Share on ${p.label}`}
              aria-label={`Share on ${p.label}`}
              className="group flex items-center justify-center gap-[7px] rounded-xl border border-line bg-white/[0.03] py-[11px] text-[12.5px] font-semibold text-ink-soft transition-all duration-200 ease-out hover:-translate-y-[1px] hover:bg-[var(--pb)]/[0.12] hover:text-white"
              style={
                {
                  "--pb": p.brand,
                  // brand-colored border + glow on hover via inline custom props
                } as React.CSSProperties
              }
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${p.brand}66`;
                e.currentTarget.style.boxShadow = `0 6px 18px -8px ${p.brand}80`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.boxShadow = "";
              }}
            >
              <Icon size={15} />
              <span className="max-[380px]:hidden">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* save group — Download is the highest-intent action here (people save
          the image to repost), so it's the hero of this row; Copy + Link are
          clear secondary buttons beside it. */}
      {(() => {
        const dl = EXPORTS.find((a) => a.id === "download")!;
        const rest = EXPORTS.filter((a) => a.id !== "download");
        const dlDone = done === dl.id;
        const dlBusy = busy === dl.id;
        const DlIcon = dl.icon;
        return (
          <div className="grid w-full grid-cols-[1.6fr_1fr_1fr] gap-[8px]">
            {/* DOWNLOAD — hero: tinted in the card's own tier color, filled,
                lifts + glows on hover */}
            <button
              onClick={() => runExport(dl)}
              disabled={dlBusy}
              title="Download your card as an image"
              aria-label="Download your card as an image"
              className="group relative flex items-center justify-center gap-[8px] overflow-hidden rounded-xl border py-[12px] text-[13.5px] font-bold tracking-[.02em] transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 active:scale-[.98] disabled:opacity-70"
              style={{
                color: tier,
                borderColor: `${tier}66`,
                background: `${tier}1f`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${tier}b3`;
                e.currentTarget.style.background = `${tier}33`;
                e.currentTarget.style.boxShadow = `0 10px 26px -8px ${tier}8c`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${tier}66`;
                e.currentTarget.style.background = `${tier}1f`;
                e.currentTarget.style.boxShadow = "";
              }}
            >
              {dlBusy ? (
                <span
                  className="h-[15px] w-[15px] animate-spin rounded-full border-[1.5px]"
                  style={{ borderColor: `${tier}40`, borderTopColor: tier }}
                />
              ) : dlDone ? (
                <Check size={16} strokeWidth={2.6} />
              ) : (
                <DlIcon size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-y-[1px]" />
              )}
              {dlBusy ? "Saving…" : dlDone ? "Saved" : "Download"}
            </button>

            {/* COPY + LINK — secondary buttons */}
            {rest.map((a) => {
              const isDone = done === a.id;
              const isBusy = busy === a.id;
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  onClick={() => runExport(a)}
                  disabled={isBusy}
                  title={a.title}
                  aria-label={a.title}
                  className="group inline-flex items-center justify-center gap-[6px] rounded-xl border border-line bg-white/[0.03] py-[12px] text-[12.5px] font-semibold text-ink-soft transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:translate-y-0 active:scale-[.98] disabled:opacity-60"
                >
                  {isBusy ? (
                    <span className="h-[13px] w-[13px] animate-spin rounded-full border-[1.5px] border-white/25 border-t-white/80" />
                  ) : isDone ? (
                    <Check size={14} className="text-brand" />
                  ) : (
                    <Icon size={14} className="transition-colors group-hover:text-white" />
                  )}
                  {isBusy ? "…" : isDone ? a.done : a.label}
                </button>
              );
            })}
          </div>
        );
      })()}

      {error && <p className="text-center text-[12px] leading-snug text-[#ff9d96]">{error}</p>}
    </div>
  );
}
