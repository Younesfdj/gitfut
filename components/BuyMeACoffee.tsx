"use client";

import { Coffee } from "lucide-react";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const BMC_URL = "https://buymeacoffee.com/gitfut";

// Floating support pill — fixed bottom-right on home + scout report. Gold, not
// green: green is reserved for the scout action, and gold echoes Buy Me a
// Coffee's yellow while staying inside the WC26 palette. Mounted per-screen
// (AppShell + ResultView) as a sibling of <main> — main's z-[2] stacking
// context would trap the pill's z-40 — and never in the root layout, so it
// stays off the loading/404/error screens. Collapses to an icon-only 44px
// circle on small screens so it can't crowd the wrapped, centered footer
// credit, and auto-hides on scroll-down there (see useHideOnScroll).
export default function BuyMeACoffee() {
  const hidden = useHideOnScroll();
  // rise-soft's 0% frame is invisible, so the delay doubles as a "let the page
  // settle first" gate. Delay + fill must live in `style`: the
  // animate-rise-soft shorthand resets any class-based delay, and the theme
  // token's `both` fill would keep the 100% frame's transform pinned after the
  // entrance, eating the hover lift — `backwards` releases it.
  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noopener"
      aria-label="Buy me a coffee"
      title="Buy me a coffee"
      className="animate-rise-soft fixed bottom-[calc(clamp(14px,3vh,22px)_+_54px)] right-[clamp(14px,3vw,22px)] z-40 flex h-[44px] items-center gap-[8px] rounded-full border border-line bg-panel/90 px-[16px] text-[12.5px] font-semibold leading-none text-ink-soft shadow-[0_8px_24px_-8px_rgba(1,4,9,.7)] backdrop-blur-[6px] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-gold/50 hover:text-ink hover:shadow-[0_8px_24px_-8px_rgba(1,4,9,.7),0_0_14px_rgba(212,175,55,.22)] active:translate-y-0 active:scale-[.98] max-[560px]:w-[44px] max-[560px]:justify-center max-[560px]:gap-0 max-[560px]:px-0"
      style={{
        animationDelay: "1.2s",
        animationFillMode: "backwards",
        // Slide down + fade out when auto-hidden on mobile scroll-down; leave
        // transform unset when visible so the hover/active lifts still work.
        transform: hidden ? "translateY(160%)" : undefined,
        opacity: hidden ? 0 : undefined,
        pointerEvents: hidden ? "none" : undefined,
      }}
    >
      <Coffee
        size={15}
        color="var(--color-gold)"
        aria-hidden
        className="shrink-0"
      />
      <span className="max-[560px]:hidden">Support the Builders</span>
    </a>
  );
}
