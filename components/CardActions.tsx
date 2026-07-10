"use client";

import { useEffect, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { Check, ChevronDown, Copy, Download, ImageDown, Link2, Share2 } from "lucide-react";
import type { Card } from "@/lib/scoring/types";
import { cardUrl, intentUrl, nativeSharePayload } from "@/lib/share";
import { renderCardImage } from "@/lib/capture";
import { useShareActions } from "@/hooks/useShareActions";
import { XLogo, LinkedInLogo } from "./BrandIcons";
import { resolveResultTheme } from "./finishTheme";

// The on-page card is small, so it captures at 3× to hit print resolution. The
// story frame is already rendered at its native 1080×1920, so 1× is exact —
// upscaling it would just bloat the file for no added detail.
const RENDER_OPTS = { pixelRatio: 3, cacheBust: true } as const;
const STORY_RENDER_OPTS = { pixelRatio: 1, cacheBust: true } as const;

// Feedback and progress copy per action — shown on the split button itself
// (the menu closes as soon as an item is picked, so the button carries the
// "Saving… → Saved" story for everything in it).
type ActionId = "download" | "copy" | "story" | "link";

const ACTION_COPY: Record<ActionId, { name: string; busy: string; done: string }> = {
  download: { name: "Download", busy: "Saving…", done: "Saved" },
  copy: { name: "Copy image", busy: "Copying…", done: "Copied" },
  story: { name: "Story", busy: "Rendering…", done: "Done" },
  link: { name: "Copy link", busy: "…", done: "Link copied" },
};

const ICON_BTN =
  "group flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-ink-soft transition-all duration-200 ease-out hover:-translate-y-[1px] hover:text-white active:translate-y-0 active:scale-[.96]";

const MENU_ITEM =
  "flex w-full items-center gap-[9px] rounded-lg px-[11px] py-[9px] text-left text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-white/[0.06] hover:text-white";

// Brand-colored border + glow on hover, so each target reads as tappable and
// recognizable rather than identical grey squares.
const brandHover = (brand: string) => ({
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = `${brand}66`;
    e.currentTarget.style.boxShadow = `0 6px 18px -8px ${brand}80`;
    e.currentTarget.style.background = `${brand}1a`;
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = "";
    e.currentTarget.style.boxShadow = "";
    e.currentTarget.style.background = "";
  },
});

export default function CardActions({
  card,
  targetRef,
  storyRef,
  canonicalCountry = "",
}: {
  card: Card;
  targetRef: React.RefObject<HTMLDivElement | null>;
  /** Off-screen 1080×1920 story canvas, captured for the Instagram-Story export. */
  storyRef: React.RefObject<HTMLDivElement | null>;
  /** GitHub-derived flag; the share link only carries ?country= when overridden. */
  canonicalCountry?: string;
}) {
  const [done, setDone] = useState<ActionId | null>(null);
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  // Whether the current open came from the keyboard (click detail === 0), so
  // only keyboard users get focus moved into the menu — mouse users keep it
  // where they clicked.
  const openedByKey = useRef(false);

  // Download CTA picks up the card's own tier color so the action matches the
  // card the user is saving (bronze → bronze, silver → silver, TOTY → blue,
  // founder → their accent).
  const tier = resolveResultTheme(card).ink;

  // Both halves of the split button wear the same tier tint and hover swap —
  // inline (not a CSS class) because the tier color is data-driven.
  const splitHalf = {
    style: { color: tier, borderColor: `${tier}66`, background: `${tier}1f` },
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = `${tier}33`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = `${tier}1f`;
    },
  };

  // The share/copy link carries ?country= ONLY when the flag is a manual override
  // (differs from the GitHub-derived default). Otherwise we strip it so the URL
  // stays clean — the recipient still resolves to the same canonical flag.
  const shareCard =
    card.country && card.country !== canonicalCountry ? card : { ...card, country: "" };

  // Share gestures (native sheet + copy link) — shared with DuelView. The
  // native payload attaches the freshly rendered card image when the platform
  // can share files; otherwise it falls back to the text+url payload, and a
  // failed/unsupported share opens the X intent.
  const { canNativeShare, nativeShare, copyLink } = useShareActions({
    getSharePayload: async () => {
      const node = targetRef.current;
      const payload = nativeSharePayload(shareCard);
      if (node && "canShare" in navigator) {
        const blob = await renderCardImage(node, (n) => toBlob(n, RENDER_OPTS));
        if (blob) {
          const file = new File([blob], `${card.login}-gitfut.png`, { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            return { ...payload, files: [file] };
          }
        }
      }
      return payload;
    },
    getIntentUrl: () => intentUrl("x", shareCard),
    getCopyUrl: () => cardUrl(shareCard),
  });

  // Escape closes the export menu (returning focus to the caret that opened
  // it); a pointerdown outside menuRef is the click-away. Not onBlur with
  // relatedTarget: WebKit and macOS Firefox fire blur with a null relatedTarget
  // before a menu item's click, which would unmount the menu and swallow the
  // click — and Safari buttons never take focus on mouse click, so focus loss
  // alone can't detect clicking elsewhere either.
  useEffect(() => {
    if (!menuOpen) return;
    if (openedByKey.current) {
      menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        caretRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  // Minimal ARIA-menu keyboard support: ArrowDown/ArrowUp rove focus through
  // the items, wrapping at the ends (entry focus + Escape live in the effect).
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [],
    );
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[e.key === "ArrowDown" ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1]?.focus();
  };

  const finish = (id: ActionId) => {
    setDone(id);
    setTimeout(() => setDone((d) => (d === id ? null : d)), 1500);
  };

  const track = async (id: ActionId, run: () => Promise<void>) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    setMenuOpen(false);
    try {
      await run();
      finish(id);
    } catch (e) {
      console.error(`[gitfut] card ${id} failed:`, e);
      setError(`${ACTION_COPY[id].name} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const downloadPng = () =>
    track("download", async () => {
      const node = targetRef.current;
      if (!node) return;
      // renderCardImage awaits fonts and captures an off-screen clone that
      // carries the gitfut.com signature (hidden on the live card).
      const url = await renderCardImage(node, (n) => toPng(n, RENDER_OPTS));
      const a = document.createElement("a");
      a.download = `${card.login}-gitfut.png`;
      a.href = url;
      a.click();
    });

  const copyImage = () =>
    track("copy", async () => {
      const node = targetRef.current;
      if (!node) return;
      // Pass a Promise<Blob> so clipboard.write() fires synchronously within the
      // click's user activation (a menu-item click is one); awaiting the slow 3x
      // render first lets the activation lapse → NotAllowedError. The browser
      // awaits the blob itself.
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": renderCardImage(
            node,
            async (n) => {
              const blob = await toBlob(n, RENDER_OPTS);
              if (!blob) throw new Error("render returned no image");
              return blob;
            },
            { transparent: true },
          ),
        }),
      ]);
    });

  // Instagram-Story export (1080×1920). On mobile, prefer the native share sheet
  // with the image attached — that's the one-tap route into IG Stories. On
  // desktop (no reliable file share), fall back to downloading the PNG.
  const shareStory = () =>
    track("story", async () => {
      const node = storyRef.current;
      if (!node) return;
      const blob = await renderCardImage(node, async (n) => {
        const b = await toBlob(n, STORY_RENDER_OPTS);
        if (!b) throw new Error("render returned no image");
        return b;
      });
      const file = new File([blob], `${card.login}-gitfut-story.png`, { type: "image/png" });

      // navigator.share with a file is often advertised on desktop (canShare
      // = true) but no-ops — so it must never be the only outcome. Only mobile
      // (coarse pointer) attempts share; everyone else downloads, and a failed
      // share also falls back to download.
      const isMobile =
        typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
      let shared = false;
      if (
        isMobile &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ ...nativeSharePayload(shareCard), files: [file] });
          shared = true;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") {
            shared = true; // user saw the sheet and chose to dismiss — don't also download
          }
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = file.name;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }
    });

  const copyCardLink = () =>
    track("link", async () => {
      // copyLink reports failure as `false` (DuelView wants that shape) — turn
      // it into a throw here so track shows its error state instead of a false
      // "Link copied".
      if (!(await copyLink())) throw new Error("clipboard unavailable");
    });

  // The split button's main zone tells the whole story: idle label, per-action
  // progress, then the action's done copy.
  const mainLabel = busy
    ? ACTION_COPY[busy].busy
    : done
      ? ACTION_COPY[done].done
      : "Download";

  return (
    <div className="flex w-full flex-col gap-[10px]">
      {/* primary — only where the platform has a native share sheet
          (canNativeShare stays false through SSR/first paint and is revealed
          post-hydration); on desktop the CTA never renders, so it can't
          degrade into a duplicate of the X icon below. */}
      {canNativeShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="font-display group relative flex h-[50px] w-full items-center justify-center gap-[9px] overflow-hidden rounded-xl bg-gradient-to-b from-brand to-brand-mid text-[18px] tracking-[.05em] text-[#04130a] shadow-[0_0_0_1px_rgba(57,211,83,.45),0_10px_28px_-6px_rgba(57,211,83,.5)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_0_0_1px_rgba(86,224,107,.6),0_14px_34px_-6px_rgba(57,211,83,.62)] active:translate-y-0 active:scale-[.985] active:duration-75"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
          <Share2 size={18} strokeWidth={2.5} className="relative" />
          <span className="relative">SHARE MY CARD</span>
        </button>
      )}

      {/* the action row: two icon-square share targets + the Download split
          button (main zone downloads instantly; the caret opens the export
          menu — Copy image, Story format, Copy link). */}
      <div className="flex w-full gap-[8px]">
        <button
          type="button"
          onClick={() => window.open(intentUrl("x", shareCard), "_blank", "noopener,noreferrer")}
          title="Share on X"
          aria-label="Share on X"
          className={ICON_BTN}
          {...brandHover("#ffffff")}
        >
          <XLogo size={16} />
        </button>
        <button
          type="button"
          onClick={() => window.open(intentUrl("linkedin", shareCard), "_blank", "noopener,noreferrer")}
          title="Share on LinkedIn"
          aria-label="Share on LinkedIn"
          className={ICON_BTN}
          {...brandHover("#3b9eff")}
        >
          <LinkedInLogo size={16} />
        </button>

        <div ref={menuRef} className="relative flex min-w-0 flex-1">
          <button
            type="button"
            onClick={downloadPng}
            disabled={!!busy}
            title="Download your card as an image"
            aria-label="Download your card as an image"
            className={`group flex h-[46px] min-w-0 flex-1 items-center justify-center gap-[8px] rounded-tl-xl border border-r-0 text-[13.5px] font-bold tracking-[.02em] transition-all duration-200 ease-out disabled:opacity-70 ${menuOpen ? "" : "rounded-bl-xl"}`}
            {...splitHalf}
          >
            {busy ? (
              <span
                className="h-[15px] w-[15px] shrink-0 animate-spin rounded-full border-[1.5px]"
                style={{ borderColor: `${tier}40`, borderTopColor: tier }}
              />
            ) : done ? (
              <Check size={16} strokeWidth={2.6} className="shrink-0" />
            ) : (
              <Download
                size={16}
                strokeWidth={2.4}
                className="shrink-0 transition-transform group-hover:translate-y-[1px]"
              />
            )}
            <span className="truncate">{mainLabel}</span>
          </button>
          <button
            ref={caretRef}
            type="button"
            onClick={(e) => {
              openedByKey.current = e.detail === 0; // Enter/Space clicks carry detail 0
              setMenuOpen((o) => !o);
            }}
            disabled={!!busy}
            title="More export options"
            aria-label="More export options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`flex h-[46px] w-[34px] shrink-0 items-center justify-center rounded-tr-xl border transition-all duration-200 ease-out disabled:opacity-70 ${menuOpen ? "" : "rounded-br-xl"}`}
            {...splitHalf}
          >
            <ChevronDown
              size={15}
              strokeWidth={2.4}
              className={`transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Export options"
              onKeyDown={onMenuKeyDown}
              className="absolute inset-x-0 top-full z-20 overflow-hidden rounded-b-xl border border-t-0 bg-bg-deep p-[4px] shadow-[0_14px_36px_-10px_rgba(0,0,0,.8)]"
              style={{
                borderColor: `${tier}66`,
                backgroundImage: `linear-gradient(${tier}1f, ${tier}1f)`,
                animation: "pop .16s cubic-bezier(.16,1,.3,1) both",
              }}
            >
              {/* literal items (no render-built handler array): the compiler
                  only trusts ref-reading closures in onClick position */}
              <button type="button" role="menuitem" onClick={copyImage} className={MENU_ITEM}>
                <Copy size={14} className="shrink-0" />
                Copy image
              </button>
              <button type="button" role="menuitem" onClick={shareStory} className={MENU_ITEM}>
                <ImageDown size={14} className="shrink-0" />
                Story format
              </button>
              <button type="button" role="menuitem" onClick={copyCardLink} className={MENU_ITEM}>
                <Link2 size={14} className="shrink-0" />
                Copy link
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-center text-[12px] leading-snug text-[#ff9d96]">{error}</p>}
    </div>
  );
}
